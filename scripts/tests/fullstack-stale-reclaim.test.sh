#!/usr/bin/env bash
# Regression test for scripts/lib/fullstack-stale-reclaim.sh: the stale
# Compose-project reclaim decision scripts/e2e-fullstack-in-docker.sh's
# `cleanup_stale_fullstack_projects` uses to tell a dead run's leftover
# project apart from a LIVE concurrent one before tearing it down.
#
# Background: the previous version of this logic judged a labelled owner
# PID dead with `kill -0 "$owner_pid"`. `kill -0` asks the kernel "may I
# SIGNAL this PID" — it fails with EPERM for a PID that DOES exist but is
# owned by a different user, which is indistinguishable, from the exit
# code alone, from the PID not existing at all (ESRCH). On a shared CI
# runner or dev box, that means a live concurrent full-stack e2e run
# started by another user gets its Compose project torn down mid-run by
# this one — a destructive bug, not a cosmetic one. Case 3 below reproduces
# exactly that: a root-owned live process, checked as an unprivileged user,
# the one shape `kill -0` cannot get right.
#
# Runs every real-process case inside the pinned `bash:5.2` image (Alpine +
# real bash, `su`, and a `nobody` user — verified interactively while
# writing this test), the same way scripts/tests/docker-volume.test.sh and
# scripts/tests/api-base-url-guard.test.sh run their own checks inside a
# pinned image rather than against the host's own process table or shell.
# The lib file under test is bind-mounted read-only from THIS checkout, so
# every case runs the exact shipped code, never a reimplementation that
# could drift out of sync with it.
#
# Usage: scripts/tests/fullstack-stale-reclaim.test.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
IMAGE="bash:5.2"
LIB_PATH="/workspace/scripts/lib/fullstack-stale-reclaim.sh"

FAILURES=0

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "OK: $1"
}

# Runs a bash payload inside the pinned image with this repo mounted
# read-only at /workspace, and returns its combined stdout+stderr. A
# non-zero container exit is a hard test failure in its own right (a crash
# proves nothing about the case under test), not something a case's own
# parsing could quietly treat as a valid result.
run_in_container() {
  local extra_mount="${1:-}"
  local script="$2"
  local mounts=(-v "${REPO_DIR}:/workspace:ro")
  if [ -n "${extra_mount}" ]; then
    mounts+=(-v "${extra_mount}")
  fi
  docker run --rm "${mounts[@]}" "${IMAGE}" /usr/local/bin/bash -c "${script}"
}

echo "== real-process cases: dead / own-live / other-host / malformed labels =="
same_user_output="$(run_in_container "" '
set -euo pipefail
. '"${LIB_PATH}"'

# Case: owner dead. A real PID, started and then killed inside THIS
# container, waited on until /proc/$pid actually disappears — not just
# until the signal was delivered — so the check never races the kill.
sleep 100 &
dead_pid=$!
kill "${dead_pid}"
wait "${dead_pid}" 2>/dev/null || true
while [ -d "/proc/${dead_pid}" ]; do sleep 0.05; done
if should_reclaim_stale_project "${dead_pid}" "host-a" "host-a"; then
  echo "DEAD=reclaimed"
else
  echo "DEAD=untouched"
fi

# Case: owner alive, same (root) user as the checker.
sleep 100 &
live_pid=$!
if should_reclaim_stale_project "${live_pid}" "host-a" "host-a"; then
  echo "OWN_LIVE=reclaimed"
else
  echo "OWN_LIVE=untouched"
fi
kill "${live_pid}" 2>/dev/null || true

# Case: a genuinely live PID, but the label names a DIFFERENT host than
# this one — must be left untouched regardless of liveness.
sleep 100 &
other_host_pid=$!
if should_reclaim_stale_project "${other_host_pid}" "some-other-host" "host-a"; then
  echo "OTHER_HOST=reclaimed"
else
  echo "OTHER_HOST=untouched"
fi
kill "${other_host_pid}" 2>/dev/null || true

# Cheap malformed-label cases: none of these should ever reach a liveness
# check at all, so no real PID is needed for them.
if should_reclaim_stale_project "" "host-a" "host-a"; then
  echo "EMPTY_PID=reclaimed"
else
  echo "EMPTY_PID=untouched"
fi
if should_reclaim_stale_project "not-a-pid" "host-a" "host-a"; then
  echo "NON_NUMERIC_PID=reclaimed"
else
  echo "NON_NUMERIC_PID=untouched"
fi
if should_reclaim_stale_project "1" "" "host-a"; then
  echo "EMPTY_HOST=reclaimed"
else
  echo "EMPTY_HOST=untouched"
fi
')"

check_result() {
  local label="$1" line="$2" want="$3"
  if printf '%s\n' "${same_user_output}" | grep -qx "${line}=${want}"; then
    pass "${label}: ${want}"
  else
    fail "${label}: expected ${line}=${want}, got: $(printf '%s\n' "${same_user_output}" | grep "^${line}=" || echo '<no matching line>')"
  fi
}

check_result "owner dead" "DEAD" "reclaimed"
check_result "owner alive, same user" "OWN_LIVE" "untouched"
check_result "owner alive, different host label" "OTHER_HOST" "untouched"
check_result "empty owner PID" "EMPTY_PID" "untouched"
check_result "non-numeric owner PID" "NON_NUMERIC_PID" "untouched"
check_result "empty owner host" "EMPTY_HOST" "untouched"

echo "== real cross-user case: owner alive, OTHER user (the EPERM case) =="
# The case `kill -0` gets wrong: root starts a real, live process; the
# liveness check itself runs as the unprivileged `nobody` user (this
# image's `su` can drop to it directly, no sudo/setuid needed). `kill -0`
# from `nobody` against a root-owned PID fails with EPERM, which the OLD
# code treated the same as "no such process" — reclaiming a live run. The
# comparison against `old_kill0_is_alive` below is not exercised by
# `scripts/lib/fullstack-stale-reclaim.sh` (which never calls `kill -0`
# any more); it exists only so this test documents, and keeps proving,
# exactly the failure mode the fix replaces — if someone ever reintroduces
# a `kill -0` check here, this line demonstrates why not to.
other_user_output="$(run_in_container "" '
set -euo pipefail
. '"${LIB_PATH}"'
old_kill0_is_alive() { kill -0 "$1" 2>/dev/null; }

sleep 100 &
root_pid=$!

su -s /usr/local/bin/bash nobody -c "
  . /workspace/scripts/lib/fullstack-stale-reclaim.sh
  old_kill0_is_alive() { kill -0 \"\$1\" 2>/dev/null; }
  if pid_is_alive ${root_pid}; then echo NEW_CHECK=alive; else echo NEW_CHECK=dead; fi
  if old_kill0_is_alive ${root_pid}; then echo OLD_CHECK=alive; else echo OLD_CHECK=dead; fi
  if should_reclaim_stale_project ${root_pid} host-a host-a; then
    echo OTHER_USER=reclaimed
  else
    echo OTHER_USER=untouched
  fi
"
kill "${root_pid}" 2>/dev/null || true
')"

if printf '%s\n' "${other_user_output}" | grep -qx "NEW_CHECK=alive"; then
  pass "other-user: /proc-based pid_is_alive correctly reports the root-owned process alive"
else
  fail "other-user: pid_is_alive should have reported the root-owned process alive; got: ${other_user_output}"
fi
if printf '%s\n' "${other_user_output}" | grep -qx "OLD_CHECK=dead"; then
  pass "other-user: the retired kill -0 check reproduces the EPERM-as-dead bug (documented, not used by the fix)"
else
  fail "other-user: expected the retired kill -0 check to (still) misreport EPERM as dead, proving this case is real; got: ${other_user_output}"
fi
if printf '%s\n' "${other_user_output}" | grep -qx "OTHER_USER=untouched"; then
  pass "other-user: should_reclaim_stale_project leaves a live other-user-owned process untouched"
else
  fail "other-user: expected OTHER_USER=untouched, got: ${other_user_output}"
fi

echo "== integration: cleanup_stale_fullstack_projects with docker stubbed =="
# Exercises the wiring around should_reclaim_stale_project — project-name
# prefix filtering, skipping this run's OWN project, and reading
# docker ps/compose ls output — not just the pure decision function above.
# `docker` itself is stubbed via a PATH shim (a fake executable ahead of
# the real one, same technique the task's own instructions call for) so
# this never touches a real Docker daemon from inside the container: it
# only proves cleanup_stale_fullstack_projects calls `docker compose ...
# down` for exactly the project whose owner is dead.
STUB_DIR="$(mktemp -d)"
trap 'rm -rf "${STUB_DIR}"' EXIT

cat >"${STUB_DIR}/docker" <<'STUB'
#!/usr/bin/env bash
# Fake `docker` for the cleanup_stale_fullstack_projects integration case
# below: never touches a real daemon, only prints back canned data the
# test controls via DEAD_PID, and records every reclaim ("down") call on
# stdout as RECLAIMED:<project> so the test can assert on it afterwards.
set -euo pipefail
case "$1" in
  compose)
    shift
    if [ "${1:-}" = "ls" ]; then
      printf '%s\n' \
        "legajo-frontend-fullstack-e2e-dead" \
        "legajo-frontend-fullstack-e2e-live-self" \
        "legajo-frontend-fullstack-e2e-other-host" \
        "legajo-frontend-fullstack-e2e-current" \
        "not-our-prefix-project"
      exit 0
    fi
    # The real invocation is `compose -p PROJECT -f F1 -f F2 down
    # --remove-orphans` — "down" is NOT at a fixed position (it comes
    # after a variable number of `-p`/`-f` pairs), so this scans every
    # argument instead of assuming one, the same reasoning
    # scripts/lib/fullstack-stale-reclaim.sh itself applies to reading
    # `docker ps`'s output rather than trusting a fixed line count.
    project=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        -p)
          project="$2"
          shift 2
          ;;
        down)
          echo "RECLAIMED:${project}"
          exit 0
          ;;
        *)
          shift
          ;;
      esac
    done
    ;;
  ps)
    filter=""
    for arg in "$@"; do
      case "${arg}" in
        label=com.docker.compose.project=*)
          filter="${arg#label=com.docker.compose.project=}"
          ;;
      esac
    done
    case "${filter}" in
      legajo-frontend-fullstack-e2e-dead) echo "${DEAD_PID}|test-host" ;;
      legajo-frontend-fullstack-e2e-live-self) echo "1|test-host" ;;
      legajo-frontend-fullstack-e2e-other-host) echo "1|some-other-host" ;;
      *) echo "|" ;;
    esac
    ;;
  *)
    exit 0
    ;;
esac
STUB
chmod +x "${STUB_DIR}/docker"

integration_output="$(run_in_container "${STUB_DIR}:/stub:ro" '
set -euo pipefail
export PATH="/stub:${PATH}"
. '"${LIB_PATH}"'

sleep 100 &
DEAD_PID=$!
kill "${DEAD_PID}"
wait "${DEAD_PID}" 2>/dev/null || true
while [ -d "/proc/${DEAD_PID}" ]; do sleep 0.05; done
export DEAD_PID

COMPOSE_PROJECT="legajo-frontend-fullstack-e2e-current"
COMPOSE_FILE="/dummy/docker-compose.yml"
COMPOSE_LABEL_FILE="/dummy/labels.yml"
LEGAJO_FULLSTACK_E2E_OWNER_HOST="test-host"

cleanup_stale_fullstack_projects
')"

if printf '%s\n' "${integration_output}" | grep -qx "RECLAIMED:legajo-frontend-fullstack-e2e-dead"; then
  pass "integration: the dead-owner project was reclaimed"
else
  fail "integration: expected the dead-owner project to be reclaimed; output:\n${integration_output}"
fi
for untouched_project in \
  legajo-frontend-fullstack-e2e-live-self \
  legajo-frontend-fullstack-e2e-other-host \
  legajo-frontend-fullstack-e2e-current \
  not-our-prefix-project; do
  if printf '%s\n' "${integration_output}" | grep -qx "RECLAIMED:${untouched_project}"; then
    fail "integration: '${untouched_project}' must never be reclaimed; output:\n${integration_output}"
  else
    pass "integration: '${untouched_project}' left untouched"
  fi
done

if [ "${FAILURES}" -gt 0 ]; then
  echo "fullstack-stale-reclaim.test.sh: ${FAILURES} case(s) failed" >&2
  exit 1
fi
echo "fullstack-stale-reclaim.test.sh: all cases passed"
