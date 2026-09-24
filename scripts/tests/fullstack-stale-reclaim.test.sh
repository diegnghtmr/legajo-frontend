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
# A THIRD identity dimension matters beyond who owns a PID and on which
# host: the PID NAMESPACE it was assigned in. Hostname (a UTS identity)
# says nothing about that — two containers sharing this host's Docker
# socket, with the SAME hostname label but SEPARATE pid namespaces, would
# each see the OTHER's live owner PID as ESRCH (no such process — IN THIS
# NAMESPACE) and reclaim a live run out from under it. The
# "DIFFERENT_PIDNS"/"MISSING_PIDNS_LABEL" cases below prove that
# `should_reclaim_stale_project` requires the pid namespace to match too,
# and is never fooled into reclaiming a same-host project with no (or a
# mismatched) pidns label.
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
#
# Env:
#   LEGAJO_STALE_RECLAIM_REQUIRE_HIDEPID   when set (to anything
#                          non-empty), a skipped hidepid=2 case (see
#                          below) becomes a hard failure instead of a
#                          reported skip — set in CI's own script-tests
#                          job (.github/workflows/frontend.yml), where
#                          this runtime is expected to always support it.
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
# repo bind-mounted read-only at /workspace and this SUITE's own
# SUPPORT_DIR (scripts/tests/support/fullstack-stale-reclaim/, NOT the
# broader scripts/tests/support/) bind-mounted read-only at /support.
# Extra `docker run` flags, if any, are given as plain arguments between
# `out_var` and a literal `--` separator marking where COMMAND begins — a
# real positional array, never a space-joined string split back apart
# with `read -ra`: that split breaks the moment a flag's own VALUE
# contains a space, and `"${extra_docker_args[@]}"` on an EMPTY array
# aborts under `set -u` on bash older than 4.4 (e.g. macOS's shipped
# /bin/bash 3.2) — `${extra_docker_args[@]+"${extra_docker_args[@]}"}`
# below is the portable idiom that never hits that case regardless of how
# the array ended up empty.
#
# On success, writes the container's combined stdout+stderr into the
# variable named by `out_var` and returns 0. On a non-zero container
# exit, still writes that combined output into `out_var` (so the caller
# can report it) and returns that same non-zero status — the caller
# decides whether that's a hard test failure or an expected, reported
# "unavailable in this runtime" case (see the hidepid case below). This
# function is called directly, never through `$(...)`: assigning inside a
# command substitution would run it in a SUBSHELL, where a `fail` call
# could never update this script's own FAILURES counter once that
# subshell exits.
run_in_container() {
  local out_var="$1"
  shift
  local extra_docker_args=()
  while [ "$1" != "--" ]; do
    extra_docker_args+=("$1")
    shift
  done
  shift # consume the "--" separator itself; "$@" is now COMMAND and its args
  local output
  local exit_code=0
  output="$(docker run --rm \
    -v "${REPO_DIR}:/workspace:ro" \
    -v "${SUPPORT_DIR}:/support:ro" \
    "${extra_docker_args[@]+"${extra_docker_args[@]}"}" \
    "${IMAGE}" "$@" 2>&1)" || exit_code=$?
  printf -v "${out_var}" '%s' "${output}"
  return "${exit_code}"
}

echo "== real-process cases: dead / own-live / other-host / malformed labels / classification =="
same_user_output=""
if ! run_in_container same_user_output -- /support/same-user-cases.sh; then
  fail "same-user cases: container exited non-zero; output:
${same_user_output}"
fi
check_result "owner dead" "${same_user_output}" "DEAD" "reclaimed"
check_result "owner dead, same host, DIFFERENT pid namespace" "${same_user_output}" "DIFFERENT_PIDNS" "untouched"
check_result "owner dead, same host, NO pidns label at all (legacy project)" \
  "${same_user_output}" "MISSING_PIDNS_LABEL" "untouched"
check_result "owner dead, same host, a genuine owner pidns, but THIS run's own pidns is empty" \
  "${same_user_output}" "EMPTY_THIS_PIDNS" "untouched"
check_result "owner alive, same user" "${same_user_output}" "OWN_LIVE" "untouched"
check_result "owner alive, different host label" "${same_user_output}" "OTHER_HOST" "untouched"
check_result "empty owner PID" "${same_user_output}" "EMPTY_PID" "untouched"
check_result "non-numeric owner PID" "${same_user_output}" "NON_NUMERIC_PID" "untouched"
check_result "owner PID 0" "${same_user_output}" "ZERO_PID" "untouched"
check_result "owner PID with a leading zero (007)" "${same_user_output}" "LEADING_ZERO_PID" "untouched"
check_result "empty owner host" "${same_user_output}" "EMPTY_HOST" "untouched"
check_result "classification: kill -0 success" "${same_user_output}" "CLASS_SUCCESS" "alive"
check_result "classification: confirmed ESRCH (reaped PID)" "${same_user_output}" "CLASS_ESRCH" "dead"
check_result "classification: an unrecognized kill -0 error (out-of-range PID) is treated as alive" \
  "${same_user_output}" "CLASS_UNRECOGNIZED_ERROR" "alive"

echo "== identity derivation: hostname/readlink genuinely failing under set -e =="
identity_output=""
if ! run_in_container identity_output -- /support/identity-derivation-case.sh; then
  fail "identity-derivation case: container exited non-zero; output:
${identity_output}"
fi
check_result "the retired bare hostname assignment aborts before its own fallback" \
  "${identity_output}" "OLD_ABORTED" "yes"
check_result "current_owner_host does not abort on the same failing hostname" \
  "${identity_output}" "NEW_ABORTED" "no"
check_result "current_owner_host reaches its own fallback logic" \
  "${identity_output}" "NEW_REACHED_FALLBACK" "yes"
check_result "current_owner_host's fallback (uname -n) yields a real, non-empty value" \
  "${identity_output}" "NEW_OWNER_HOST_NONEMPTY" "yes"
check_result "current_owner_pidns does not abort when readlink fails on Linux" \
  "${identity_output}" "PIDNS_ABORTED" "no"
check_result "current_owner_pidns yields an EMPTY value on Linux (never 'none')" \
  "${identity_output}" "PIDNS_EMPTY" "yes"
check_result "the production WARNING block fires for an empty pidns" \
  "${identity_output}" "WARNING_PRINTED" "yes"
check_result "the pidns chain still reaches its own end after the warning" \
  "${identity_output}" "PIDNS_CHAIN_REACHED" "yes"
check_result "current_owner_pidns does not abort when readlink and uname both fail" \
  "${identity_output}" "UNKNOWN_KERNEL_ABORTED" "no"
check_result "an unknown kernel (uname failing) yields an EMPTY pidns, never 'none'" \
  "${identity_output}" "UNKNOWN_KERNEL_PIDNS_EMPTY" "yes"

echo "== real cross-user case: owner alive, OTHER user (the EPERM case) =="
other_user_output=""
if ! run_in_container other_user_output -- /support/other-user-case.sh; then
  fail "other-user case: container exited non-zero; output:
${other_user_output}"
fi
check_result "classification: EPERM (root-owned PID, checked as nobody)" "${other_user_output}" "CLASS_EPERM" "alive"
check_result "the retired kill -0 exit-code-only check misreads EPERM as dead (documented, not used by the fix)" \
  "${other_user_output}" "OLD_CHECK" "dead"
check_result "should_reclaim_stale_project leaves a live other-user-owned process untouched" \
  "${other_user_output}" "OTHER_USER" "untouched"

echo "== real hidepid=2 case: the retired /proc-existence check's own failure mode =="
# Docker's default AppArmor profile (as shipped on GitHub's Ubuntu
# runners) denies the mount(2) syscall even with CAP_SYS_ADMIN — this
# extra flag is scoped to ONLY this one container, never the others in
# this suite, since it's the narrowest fix for the one case that actually
# needs to call `mount` itself.
hidepid_output=""
if run_in_container hidepid_output --cap-add SYS_ADMIN --security-opt apparmor=unconfined -- /support/hidepid-case.sh; then
  hidepid_status=0
else
  hidepid_status=$?
fi

# Only a recognized HIDEPID_SKIPPED marker (see hidepid-case.sh's own
# comment for exactly the two things that may set it) is ever treated as
# a skip. A non-zero container exit WITHOUT that marker is a real test
# failure — `su`, sourcing the lib, or one of hidepid-case.sh's own
# assertions actually broke — and must never be swallowed the way an
# earlier version of this case swallowed every non-zero exit here.
if printf '%s\n' "${hidepid_output}" | grep -q "^HIDEPID_SKIPPED="; then
  if [ -n "${LEGAJO_STALE_RECLAIM_REQUIRE_HIDEPID:-}" ]; then
    fail "hidepid case: skipped, but LEGAJO_STALE_RECLAIM_REQUIRE_HIDEPID is set, so this runtime is required to run it; $(printf '%s\n' "${hidepid_output}" | grep '^HIDEPID_SKIPPED=')"
  else
    echo "SKIPPED: $(printf '%s\n' "${hidepid_output}" | grep '^HIDEPID_SKIPPED=')"
  fi
elif [ "${hidepid_status}" -ne 0 ]; then
  fail "hidepid case: container exited ${hidepid_status} without a recognized HIDEPID_SKIPPED marker — a real failure, not an unavailable runtime; output:
${hidepid_output}"
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
if ! run_in_container integration_output -- /support/integration-case.sh; then
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
  legajo-frontend-fullstack-e2e-other-pidns \
  legajo-frontend-fullstack-e2e-missing-pidns \
  legajo-frontend-fullstack-e2e-current \
  not-our-prefix-project; do
  if printf '%s\n' "${integration_output}" | grep -qx "RECLAIMED:${untouched_project}"; then
    fail "integration: '${untouched_project}' must never be reclaimed; output:
${integration_output}"
  else
    pass "integration: '${untouched_project}' left untouched"
  fi
done

# The skip-log line (cleanup_stale_fullstack_projects's own explanatory
# "==> leaving ... untouched" message) must appear for every project
# skipped BECAUSE its host/pidns identity is missing or mismatched — so a
# legacy leftover holding the ports is explainable, not just silently
# never reclaimed — and must NOT appear for one skipped merely because
# it's genuinely still alive (its identity matches fine; there's nothing
# to explain).
for mismatched_project in \
  legajo-frontend-fullstack-e2e-other-host \
  legajo-frontend-fullstack-e2e-other-pidns \
  legajo-frontend-fullstack-e2e-missing-pidns; do
  if printf '%s\n' "${integration_output}" \
    | grep -q "leaving full-stack e2e project '${mismatched_project}'.*docker compose -p ${mismatched_project} down --remove-orphans"; then
    pass "integration: skip-log line explains '${mismatched_project}' (identity mismatch)"
  else
    fail "integration: expected a skip-log line naming '${mismatched_project}' and its manual-fix command; output:
${integration_output}"
  fi
done
if printf '%s\n' "${integration_output}" | grep -q "leaving full-stack e2e project 'legajo-frontend-fullstack-e2e-live-self'"; then
  fail "integration: 'legajo-frontend-fullstack-e2e-live-self' matches this run's own identity and is only skipped for being alive — it must NOT get the identity-mismatch skip-log line; output:
${integration_output}"
else
  pass "integration: no identity-mismatch skip-log line for the genuinely-alive, identity-matched project"
fi

if [ "${FAILURES}" -gt 0 ]; then
  echo "fullstack-stale-reclaim.test.sh: ${FAILURES} case(s) failed" >&2
  exit 1
fi
echo "fullstack-stale-reclaim.test.sh: all cases passed"
