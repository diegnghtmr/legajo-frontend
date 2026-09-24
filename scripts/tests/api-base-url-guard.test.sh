#!/usr/bin/env bash
# Regression test for scripts/docker/validate-vite-api-base-url.sh (the
# VITE_API_BASE_URL trim-and-validate guard the frontend Dockerfile's build
# stage calls). Runs the EXACT shipped script — never a reimplementation
# that could drift out of sync with it — inside the same `node:24-alpine`
# image the Dockerfile's build stage uses, so this proves the guard's real
# behavior on the real base image's `/bin/sh` (BusyBox ash), not on the
# host's shell.
#
# Background: an earlier version of this guard trimmed surrounding
# whitespace with `awk 'BEGIN{RS="\0"} ...'`, relying on a NUL record
# separator to make awk treat the whole value as one record. That happened
# to work on this exact BusyBox awk build (verified empirically while
# writing this test), but nothing in the POSIX awk specification defines
# `RS="\0"` behavior, so a future BusyBox (or a different base image) is
# free to split on embedded newlines instead. The guard now trims with
# plain POSIX parameter expansion (`${value#?}` / `${value%?}`), which
# needs no such assumption — this test is what keeps that guarantee real
# instead of asserted.
#
# Usage: scripts/tests/api-base-url-guard.test.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
IMAGE="node:24-alpine"
GUARD_SCRIPT="scripts/docker/validate-vite-api-base-url.sh"

FAILURES=0

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "OK: $1"
}

# Runs the guard against one raw value inside node:24-alpine and prints
# "<exit-code>|<stdout>" so a single `docker run` gives both signals a case
# needs to check, without a second round-trip per case.
run_guard() {
  local raw_value="$1"
  local exit_code=0
  local stdout
  stdout="$(
    docker run --rm -v "${REPO_DIR}:/workspace:ro" -w /workspace "${IMAGE}" \
      sh "${GUARD_SCRIPT}" "${raw_value}" 2>/dev/null
  )" || exit_code=$?
  printf '%s|%s' "${exit_code}" "${stdout}"
}

expect_trimmed() {
  local label="$1"
  local raw_value="$2"
  local want="$3"
  local result exit_code stdout
  result="$(run_guard "${raw_value}")"
  exit_code="${result%%|*}"
  stdout="${result#*|}"
  if [ "${exit_code}" != "0" ]; then
    fail "${label}: expected exit 0, got ${exit_code} (stdout: '${stdout}')"
  elif [ "${stdout}" != "${want}" ]; then
    fail "${label}: expected trimmed value '${want}', got '${stdout}'"
  else
    pass "${label}: trimmed to '${want}'"
  fi
}

expect_rejected() {
  local label="$1"
  local raw_value="$2"
  local result exit_code stdout
  result="$(run_guard "${raw_value}")"
  exit_code="${result%%|*}"
  stdout="${result#*|}"
  if [ "${exit_code}" = "0" ]; then
    fail "${label}: expected a non-zero exit, got 0 (stdout: '${stdout}')"
  elif [ -n "${stdout}" ]; then
    fail "${label}: expected no stdout on rejection, got '${stdout}'"
  else
    pass "${label}: rejected (exit ${exit_code}), no stdout"
  fi
}

# 1: a plain value with no padding passes through unchanged.
expect_trimmed "plain value" "http://localhost:8080" "http://localhost:8080"

# 2/3: surrounding spaces and tabs are trimmed.
expect_trimmed "leading/trailing spaces" "  http://localhost:8080  " "http://localhost:8080"
expect_trimmed "leading/trailing tabs" "$(printf '\thttp://localhost:8080\t')" "http://localhost:8080"

# 4/5: surrounding CR and LF are trimmed too — the exact class the old
# `awk 'BEGIN{RS="\0"}'` trim was added for, and the class a naive
# space-only trim would miss. `$(...)` command substitution silently strips
# a TRAILING newline from its own output (a classic, easy-to-miss shell
# gotcha — it is what broke an early draft of the guard script itself, see
# that script's own comments), so a trailing-LF case has to be built with a
# sentinel character appended and then removed, not a bare `$(printf ...)`.
expect_trimmed "leading/trailing CR" "$(printf '\rhttp://localhost:8080\r')" "http://localhost:8080"
lf_padded="$(printf '\nhttp://localhost:8080\nx')"
lf_padded="${lf_padded%x}"
expect_trimmed "leading/trailing LF" "${lf_padded}" "http://localhost:8080"

# 6: every whitespace class padded at once, several runs deep (same
# trailing-newline sentinel as case 5, since this padding also ends in LF).
mixed_padded="$(printf '  \t\r\nhttp://localhost:8080\n\r\t  x')"
mixed_padded="${mixed_padded%x}"
expect_trimmed "mixed multi-run padding" "${mixed_padded}" "http://localhost:8080"

# 7: an empty value is rejected, not silently accepted.
expect_rejected "empty value" ""

# 8: a whitespace-only value (including a newline) is rejected, not
# trimmed down to an empty string that then silently passes.
expect_rejected "whitespace-only value" "$(printf '   \t\r\n  ')"

# 9: interior whitespace is rejected outright, never silently repaired —
# the guard's core promise (never guess what a caller meant).
expect_rejected "interior whitespace" "http://local host:8080"

# 10: an interior newline (e.g. from a YAML block scalar) is rejected the
# same way, after surrounding whitespace is trimmed away.
expect_rejected "interior newline" "$(printf 'http://local\nhost:8080')"

if [ "${FAILURES}" -gt 0 ]; then
  echo "api-base-url-guard.test.sh: ${FAILURES} case(s) failed" >&2
  exit 1
fi
echo "api-base-url-guard.test.sh: all cases passed"
