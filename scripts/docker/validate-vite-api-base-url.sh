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
# `awk 'BEGIN{RS="\0"} {gsub(...)}'` to make awk treat the whole value as
# one record, so a leading/trailing NEWLINE (e.g. from a YAML block scalar)
# would also be trimmed, not just a leading/trailing space. Proven
# empirically (this exact base image, `node:24-alpine`, ships BusyBox awk)
# to already trim every whitespace class correctly — but that correctness
# rests on undocumented, implementation-specific behavior: nothing in the
# POSIX awk specification defines what `RS="\0"` does, so a future BusyBox
# (or a different base image entirely) is free to split on embedded
# newlines instead, silently truncating the value to whatever precedes its
# first embedded newline. The parameter-expansion loop below needs no such
# assumption: `${value#?}` and `${value%?}` remove exactly one character
# from either end regardless of what that character is, so the same code
# behaves identically on any POSIX-conforming shell.
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
  echo "  Vite inlines it into the bundle at build time (TRD Appendix A); an" >&2
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
