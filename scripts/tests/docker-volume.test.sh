#!/usr/bin/env bash
# Regression test for scripts/lib/docker-volume.sh's `prepare_host_owned_volume`
# (previously untested): runs its `find`/`chown` logic against fresh,
# disposable Docker volumes in the same `alpine` image the function itself
# uses, and checks the two cases the function exists to tell apart:
#
#   1. every entry already owned by the host uid/gid  -> no `chown -R` runs
#      (checked via ctime: a real `chown` syscall always bumps an inode's
#      ctime, even when the uid/gid it sets are unchanged, so an unchanged
#      ctime is direct proof the chown branch was skipped, not just that
#      ownership happens to still be correct).
#   2. an entry with the WRONG owner, or the wrong GROUP with a correct
#      owner, anywhere in the volume -> `chown -R` runs (checked by the
#      volume's ownership actually becoming host-owned afterwards, which
#      could only happen if the chown branch ran).
#
# Usage: scripts/tests/docker-volume.test.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
IMAGE="alpine:3.20"
WANT_UID="$(id -u)"
WANT_GID="$(id -g)"

# shellcheck source=../lib/docker-volume.sh
source "${REPO_DIR}/scripts/lib/docker-volume.sh"

FAILURES=0

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "OK: $1"
}

# A disposable volume per test case, always removed on exit (success or
# failure), so a failed run never leaks a test volume into `docker volume ls`.
TEST_VOLUMES=()
cleanup() {
  for volume in "${TEST_VOLUMES[@]:-}"; do
    [ -n "${volume}" ] && docker volume rm -f "${volume}" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

new_test_volume() {
  # Prints the created name only — does NOT append to TEST_VOLUMES itself:
  # every call site captures this via `volume="$(new_test_volume ...)"`,
  # which runs the function in a subshell, so an append made *inside* this
  # function would only ever mutate that subshell's own copy of the array
  # and be silently lost the moment the subshell exits (a classic bash
  # pitfall: `$(...)` forks). Each call site appends to TEST_VOLUMES itself,
  # in the main shell, right after capturing the name.
  local name="legajo-frontend-docker-volume-test-$1-$$"
  docker volume create "${name}" >/dev/null
  echo "${name}"
}

ctime_of() {
  # %Z is ctime (inode change time) in GNU/BusyBox `stat`'s epoch-seconds format.
  docker run --rm -v "$1:/vol" "${IMAGE}" stat -c '%Z' "/vol/$2"
}

owner_of() {
  docker run --rm -v "$1:/vol" "${IMAGE}" stat -c '%u:%g' "/vol/$2"
}

echo "== case 1: every entry already host-owned -> no chown runs =="
volume="$(new_test_volume matching-owner)"
TEST_VOLUMES+=("${volume}")
# A fresh named volume's top-level directory is root-owned until something
# chowns it, so setup always runs as root (default, no --user) and sets the
# exact ownership it needs afterwards — never relying on `--user` to create
# the file with a given owner directly, which would fail with "Permission
# denied" against that still-root-owned top-level directory.
docker run --rm -v "${volume}:/vol" "${IMAGE}" \
  sh -c "touch /vol/marker && chown -R ${WANT_UID}:${WANT_GID} /vol"
before_ctime="$(ctime_of "${volume}" marker)"
# ctime has 1-second resolution; without this, a chown that runs within the
# same second as the setup `touch` above could land on an identical ctime
# even though it DID run, producing a false pass for this test.
sleep 1.1

prepare_host_owned_volume "${volume}" "${IMAGE}"

after_ctime="$(ctime_of "${volume}" marker)"
after_owner="$(owner_of "${volume}" marker)"
if [ "${after_owner}" != "${WANT_UID}:${WANT_GID}" ]; then
  fail "case 1: expected marker to stay owned by ${WANT_UID}:${WANT_GID}, got ${after_owner}"
elif [ "${before_ctime}" != "${after_ctime}" ]; then
  fail "case 1: marker's ctime changed (${before_ctime} -> ${after_ctime}); prepare_host_owned_volume ran chown even though ownership already matched"
else
  pass "case 1: already host-owned volume -> chown skipped (ctime unchanged: ${before_ctime})"
fi

echo "== case 2: a wrong OWNER anywhere in the volume -> chown runs =="
volume="$(new_test_volume wrong-owner)"
TEST_VOLUMES+=("${volume}")
# Mostly host-owned, but with ONE root-owned file nested a level deep —
# matching docker-volume.sh's own stated interrupted-root-run scenario (an
# `-quit`-based top-level-only check would miss this): host-own the whole
# tree first, then `touch` one new file as root (default owner, no --user)
# so exactly that one file stays root-owned.
docker run --rm -v "${volume}:/vol" "${IMAGE}" sh -c "
  mkdir -p /vol/subdir
  chown -R ${WANT_UID}:${WANT_GID} /vol
  touch /vol/subdir/root-owned
"

prepare_host_owned_volume "${volume}" "${IMAGE}"

after_owner="$(owner_of "${volume}" subdir/root-owned)"
if [ "${after_owner}" = "${WANT_UID}:${WANT_GID}" ]; then
  pass "case 2: wrong-owner nested file -> chown -R ran (now ${after_owner})"
else
  fail "case 2: expected the nested root-owned file to become ${WANT_UID}:${WANT_GID}, got ${after_owner}"
fi

echo "== case 3: correct owner but wrong GROUP anywhere -> chown runs =="
if [ "${WANT_GID}" = "0" ]; then
  echo "SKIP: case 3 needs a non-root host gid to construct a group mismatch (got gid 0)"
else
  volume="$(new_test_volume wrong-group)"
  TEST_VOLUMES+=("${volume}")
  # Same uid (correct owner), group 0 (wrong group) — the case an owner-only
  # check would miss.
  docker run --rm -v "${volume}:/vol" "${IMAGE}" \
    sh -c "touch /vol/marker && chown ${WANT_UID}:0 /vol/marker"

  prepare_host_owned_volume "${volume}" "${IMAGE}"

  after_owner="$(owner_of "${volume}" marker)"
  if [ "${after_owner}" = "${WANT_UID}:${WANT_GID}" ]; then
    pass "case 3: correct-owner/wrong-group file -> chown -R ran (now ${after_owner})"
  else
    fail "case 3: expected the wrong-group file to become ${WANT_UID}:${WANT_GID}, got ${after_owner}"
  fi
fi

if [ "${FAILURES}" -gt 0 ]; then
  echo "docker-volume.test.sh: ${FAILURES} case(s) failed" >&2
  exit 1
fi
echo "docker-volume.test.sh: all cases passed"
