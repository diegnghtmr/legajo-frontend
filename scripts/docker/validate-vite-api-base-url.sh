#!/bin/sh
# Trims and validates VITE_API_BASE_URL for the frontend image build
# (Dockerfile, `ARG VITE_API_BASE_URL`). Lives in its own file, not inline
# in the Dockerfile's RUN step, so scripts/tests/api-base-url-guard.test.sh
# can run the EXACT shipped logic in a container — the same code the image
# build itself runs, never a hand-copied reimplementation that could drift
# out of sync with it.
#
# Only LEADING/TRAILING whitespace (space, tab, CR, LF) is trimmed — never
# `tr -d '[:space:]'`, which removes EVERY whitespace character, including
# in the middle of the value: a typo like
# `--build-arg 'VITE_API_BASE_URL=http://local host:8080'` would silently
# become the working-looking `http://localhost:8080` instead of failing
# loudly, defeating the entire point of this guard (never silently correct
# a value that might not be what the caller meant). Any whitespace still
# left after trimming only the ends is rejected outright below, not
# repaired.
#
# Trimmed with plain POSIX parameter expansion (`${value#?}` / `${value%?}`
# in a loop), not `awk`: an earlier version used
# `awk 'BEGIN{RS="\0"} {gsub(...)}'`, intending a literal NUL byte as the
# record separator so a leading/trailing NEWLINE (e.g. from a YAML block
# scalar) would also be trimmed. On this exact base image (`node:24-alpine`,
# BusyBox awk) it DID trim every whitespace class correctly — but only by
# accident: a C string can't hold an embedded NUL, so `RS="\0"` silently
# becomes `RS=""`, which is paragraph mode, not a NUL separator. Paragraph
# mode happens to read a blank-line-free value as one record (verified
# empirically), but would silently split on an embedded BLANK line — not on
# an ordinary single newline, which paragraph mode keeps inside the record.
# Nothing documents this fallback, so a different awk build is free to
# behave otherwise. The parameter-expansion loop below needs no such
# assumption: `${value#?}`/`${value%?}` remove one character at a time
# regardless of what it is, so it behaves identically on any POSIX shell.
#
# A literal newline cannot be written directly as `"$(printf '\n')"` in a
# `case` pattern: command substitution strips ALL trailing newlines from
# its OWN output, so `"$(printf '\n')"` silently becomes an empty string,
# turning the intended "newline" branch of the pattern into a bare `*` that
# matches everything — confirmed while writing this script (that exact
# mistake produced an infinite trim loop on the very first test). The
# sentinel trick below (`"$(printf '\nx')"` then `${nl%x}`) works around
# it: a LEADING newline survives command substitution (only trailing ones
# are stripped), and the trailing sentinel character `x` is then removed
# separately with ordinary parameter expansion, leaving exactly one LF.
#
# Usage: validate-vite-api-base-url.sh <raw-value>
#   On success: the trimmed value is printed to stdout, exit 0.
#   On failure: a clear message goes to stderr, exit 1, nothing on stdout.
set -eu

raw="${1-}"

sp=" "
tab="$(printf '\t')"
cr="$(printf '\r')"
nl="$(printf '\nx')"
nl="${nl%x}"

value="${raw}"
while true; do
  case "${value}" in
    "${sp}"* | "${tab}"* | "${cr}"* | "${nl}"*) value="${value#?}" ;;
    *) break ;;
  esac
done
while true; do
  case "${value}" in
    *"${sp}" | *"${tab}" | *"${cr}" | *"${nl}") value="${value%?}" ;;
    *) break ;;
  esac
done
trimmed="${value}"

if [ -z "${trimmed}" ]; then
  echo "ERROR: VITE_API_BASE_URL is required and must not be empty or whitespace-only." >&2
  echo "  Vite inlines it into the bundle at build time; an" >&2
  echo "  unset/blank value would silently ship a bundle pointing at the wrong API." >&2
  echo "  Docker/Compose build: --build-arg VITE_API_BASE_URL=http://localhost:8080" >&2
  echo "  Vercel: set VITE_API_BASE_URL as a Project Environment Variable instead —" >&2
  echo "  Vercel builds this app with Vite directly, not through this Dockerfile." >&2
  exit 1
fi

case "${trimmed}" in
  *[[:space:]]*)
    echo "ERROR: VITE_API_BASE_URL must not contain whitespace inside the value (surrounding whitespace is trimmed; interior whitespace is rejected, never silently removed)." >&2
    echo "  got: '${raw}'" >&2
    exit 1
    ;;
esac

printf '%s' "${trimmed}"
