#!/usr/bin/env bash
# Regression test for scripts/lib/fullstack-stale-reclaim.sh: the stale
# Compose-project reclaim decision scripts/e2e-fullstack-in-docker.sh's
# `cleanup_stale_fullstack_projects` uses to tell a dead run's leftover
# project apart from a LIVE concurrent one before tearing it down.
#
# Background: two RETIRED versions of the liveness check under test were
# both wrong. The first judged a labelled owner PID dead with
# `kill -0 "$owner_pid"`'s bare exit code — that fails with EPERM for a
# live PID owned by a DIFFERENT user, indistinguishable, from the exit
# code alone, from the PID not existing at all (ESRCH). The second fix
# read `/proc/$pid` existence instead — correct for that case, but ALSO
# wrong on a host where `/proc` is mounted with `hidepid=1`/`hidepid=2`/
# `hidepid=invisible`: an unprivileged viewer then sees no `/proc/<pid>`
# entry at all for a process it may not `ptrace`, even though it is very
# much alive. Both bugs have the SAME destructive consequence: a live
# concurrent full-stack e2e run started by another user gets its Compose
# project torn down mid-run by this one. The CURRENT check instead reads
# `kill -0`'s own error TEXT (ESRCH vs. everything else), which never goes
# through `/proc` at all — see scripts/lib/fullstack-stale-reclaim.sh's
# own comment for the full reasoning. The "other real user" case and the
# "hidepid" case below each reproduce one of the two retired bugs for
# real, not as a reimplementation asserted to behave a certain way.
#
# Runs every real-process case inside the pinned `bash:5.2` image (Alpine
# + real bash, `su`, a `nobody` user, and (for the hidepid case) `unshare`/
# `mount` — all verified interactively while writing this test), the same
# way scripts/tests/docker-volume.test.sh and
# scripts/tests/api-base-url-guard.test.sh run their own checks inside a
# pinned image rather than against the host's own process table or shell.
# The lib file under test is bind-mounted read-only from THIS checkout, so
# every case runs the exact shipped code, never a reimplementation that
# could drift out of sync with it. Every real-process case script lives in
# its own file under scripts/tests/support/ (bind-mounted alongside it),
# rather than as an inline string passed to `bash -c`: several of these
# cases already nest `unshare` inside `su` inside `docker run`, and a
# quoted string surviving that many shell layers without a subtle
# escaping bug is its own, unrelated source of test flakiness this design
# avoids entirely.
#
# Usage: scripts/tests/fullstack-stale-reclaim.test.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SUPPORT_DIR="${SCRIPT_DIR}/support/fullstack-stale-reclaim"
IMAGE="bash:5.2"

FAILURES=0

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "OK: $1"
}

# Asserts that `output` contains a line "<line>=<want>" exactly. Shared by
# every case group below instead of each hand-rolling its own
# grep/pass/fail, so a change to how a mismatch is reported only has to be
# made in one place.
check_result() {
  local label="$1" output="$2" line="$3" want="$4"
  if printf '%s\n' "${output}" | grep -qx "${line}=${want}"; then
    pass "${label}: ${want}"
  else
    fail "$(printf '%s: expected %s=%s, got:\n%s' \
      "${label}" "${line}" "${want}" \
      "$(printf '%s\n' "${output}" | grep "^${line}=" || echo '<no matching line>')")"
  fi
}

# Runs COMMAND (and its args) as the container's entrypoint, with this
# repo bind-mounted read-only at /workspace and scripts/tests/support/
# bind-mounted read-only at /support. On success, writes the container's
# combined stdout+stderr into the variable named by `out_var` and returns
# 0. On a non-zero container exit, still writes that combined output into
# `out_var` (so the caller can report it) and returns that same non-zero
# status — the caller decides whether that's a hard test failure or an
# expected, reported "unavailable in this runtime" case (see the hidepid
# case below). This function is called directly, never through `$(...)`:
# assigning inside a command substitution would run it in a SUBSHELL,
# where a `fail` call could never update this script's own FAILURES
# counter once that subshell exits.
run_in_container() {
  local out_var="$1"
  local extra_docker_args_str="$2"
  shift 2
  local extra_docker_args=()
  if [ -n "${extra_docker_args_str}" ]; then
    read -ra extra_docker_args <<<"${extra_docker_args_str}"
  fi
  local output
  local exit_code=0
  output="$(docker run --rm \
    -v "${REPO_DIR}:/workspace:ro" \
    -v "${SUPPORT_DIR}:/support:ro" \
    "${extra_docker_args[@]}" \
    "${IMAGE}" "$@" 2>&1)" || exit_code=$?
  printf -v "${out_var}" '%s' "${output}"
  return "${exit_code}"
}

echo "== real-process cases: dead / own-live / other-host / malformed labels / classification =="
same_user_output=""
if ! run_in_container same_user_output "" /support/same-user-cases.sh; then
  fail "same-user cases: container exited non-zero; output:
${same_user_output}"
fi
check_result "owner dead" "${same_user_output}" "DEAD" "reclaimed"
check_result "owner alive, same user" "${same_user_output}" "OWN_LIVE" "untouched"
check_result "owner alive, different host label" "${same_user_output}" "OTHER_HOST" "untouched"
check_result "empty owner PID" "${same_user_output}" "EMPTY_PID" "untouched"
check_result "non-numeric owner PID" "${same_user_output}" "NON_NUMERIC_PID" "untouched"
check_result "owner PID 0" "${same_user_output}" "ZERO_PID" "untouched"
check_result "owner PID with a leading zero (007)" "${same_user_output}" "LEADING_ZERO_PID" "untouched"
check_result "empty owner host" "${same_user_output}" "EMPTY_HOST" "untouched"
check_result "classification: kill -0 success" "${same_user_output}" "CLASS_SUCCESS" "alive"
check_result "classification: confirmed ESRCH (reaped PID)" "${same_user_output}" "CLASS_ESRCH" "dead"

echo "== real cross-user case: owner alive, OTHER user (the EPERM case) =="
other_user_output=""
if ! run_in_container other_user_output "" /support/other-user-case.sh; then
  fail "other-user case: container exited non-zero; output:
${other_user_output}"
fi
check_result "classification: EPERM (root-owned PID, checked as nobody)" "${other_user_output}" "CLASS_EPERM" "alive"
check_result "the retired kill -0 exit-code-only check misreads EPERM as dead (documented, not used by the fix)" \
  "${other_user_output}" "OLD_CHECK" "dead"
check_result "should_reclaim_stale_project leaves a live other-user-owned process untouched" \
  "${other_user_output}" "OTHER_USER" "untouched"

echo "== real hidepid=2 case: the retired /proc-existence check's own failure mode =="
hidepid_output=""
run_in_container hidepid_output "--cap-add SYS_ADMIN" /support/hidepid-case.sh || true
if printf '%s\n' "${hidepid_output}" | grep -q "^HIDEPID_SKIPPED="; then
  echo "SKIPPED: $(printf '%s\n' "${hidepid_output}" | grep '^HIDEPID_SKIPPED=')"
else
  check_result "the retired /proc-existence check misreads a hidepid=2-hidden live process as dead" \
    "${hidepid_output}" "OLD_PROC_CHECK" "dead"
  check_result "the current kill(2)-errno check still reports it alive under hidepid=2" \
    "${hidepid_output}" "NEW_CHECK" "alive"
fi

echo "== integration: cleanup_stale_fullstack_projects with docker stubbed =="
# Exercises the wiring around should_reclaim_stale_project — project-name
# prefix filtering, skipping this run's OWN project, and reading
# docker ps/compose ls output — not just the pure decision function
# above. `docker` itself (scripts/tests/support/fullstack-stale-reclaim/
# docker) is stubbed via a PATH shim so this never touches a real Docker
# daemon from inside the container: it only proves
# cleanup_stale_fullstack_projects calls `docker compose ... down` for
# exactly the project whose owner is dead.
integration_output=""
if ! run_in_container integration_output "" /support/integration-case.sh; then
  fail "integration case: container exited non-zero; output:
${integration_output}"
fi
if printf '%s\n' "${integration_output}" | grep -qx "RECLAIMED:legajo-frontend-fullstack-e2e-dead"; then
  pass "integration: the dead-owner project was reclaimed"
else
  fail "integration: expected the dead-owner project to be reclaimed; output:
${integration_output}"
fi
for untouched_project in \
  legajo-frontend-fullstack-e2e-live-self \
  legajo-frontend-fullstack-e2e-other-host \
  legajo-frontend-fullstack-e2e-current \
  not-our-prefix-project; do
  if printf '%s\n' "${integration_output}" | grep -qx "RECLAIMED:${untouched_project}"; then
    fail "integration: '${untouched_project}' must never be reclaimed; output:
${integration_output}"
  else
    pass "integration: '${untouched_project}' left untouched"
  fi
done

if [ "${FAILURES}" -gt 0 ]; then
  echo "fullstack-stale-reclaim.test.sh: ${FAILURES} case(s) failed" >&2
  exit 1
fi
echo "fullstack-stale-reclaim.test.sh: all cases passed"
