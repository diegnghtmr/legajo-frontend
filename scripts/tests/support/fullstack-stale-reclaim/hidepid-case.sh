#!/usr/local/bin/bash
# Entry point for the hidepid=2 regression case: starts a real, long-lived
# root-owned process, then (if this runtime allows it) proves the
# unprivileged-viewer liveness check sees it as alive even when `/proc`
# hides it entirely.
#
# Exactly TWO things are ever reported as HIDEPID_SKIPPED rather than
# failed outright:
#   1. `unshare --mount` itself cannot create a private mount namespace at
#      all (e.g. missing CAP_SYS_ADMIN) — checked FIRST, by a minimal
#      no-op probe entirely separate from the real check below, so a
#      LATER failure can never be misread as "this capability is
#      missing" when the probe already proved it is not.
#   2. hidepid-inner-root.sh's own `mount -t proc -o hidepid=2` is denied
#      (e.g. Docker's default AppArmor profile blocking mount(2) even
#      with CAP_SYS_ADMIN, as on GitHub's Ubuntu runners) — recognized
#      here ONLY by hidepid-inner-root.sh's own HIDEPID_MOUNT_UNAVAILABLE
#      marker, never by exit code alone and never by "no assertion
#      markers were printed": that heuristic would also swallow a real
#      `su`/sourcing/assertion bug as a false skip, exactly what this
#      design exists to avoid.
# Any OTHER non-zero exit from hidepid-inner-root.sh is a real test
# failure: this script propagates it with `exit`, never `|| true`.
#
# Invoked by scripts/tests/fullstack-stale-reclaim.test.sh via
# `docker run --cap-add SYS_ADMIN --security-opt apparmor=unconfined ...
# bash:5.2 /support/hidepid-case.sh`.
set -euo pipefail

sleep 100 &
root_pid=$!

if command -v unshare >/dev/null 2>&1; then
  have_unshare=1
else
  have_unshare=0
fi
if [ "${have_unshare}" -eq 0 ]; then
  echo "HIDEPID_SKIPPED=unshare not available in this image"
  kill "${root_pid}" 2>/dev/null || true
  exit 0
fi

# The probe (case 1 above): a bare `unshare --mount ... true`, entirely
# separate from the real invocation below, so THIS is the only place a
# missing CAP_SYS_ADMIN can ever be recognized as a skip.
probe_err="$(mktemp)"
if unshare --mount --propagation private true 2>"${probe_err}"; then
  probe_ok=1
else
  probe_ok=0
fi
if [ "${probe_ok}" -eq 0 ]; then
  echo "HIDEPID_SKIPPED=unshare --mount is not permitted in this runtime: $(tr '\n' ' ' <"${probe_err}")"
  rm -f "${probe_err}"
  kill "${root_pid}" 2>/dev/null || true
  exit 0
fi
rm -f "${probe_err}"

log="$(mktemp)"
if unshare --mount --propagation private /support/hidepid-inner-root.sh "${root_pid}" >"${log}" 2>&1; then
  status=0
else
  status=$?
fi

mount_unavailable="$(grep -m1 "^HIDEPID_MOUNT_UNAVAILABLE=" "${log}" || true)"
if [ "${status}" -eq 0 ] && [ -n "${mount_unavailable}" ]; then
  # Case 2 above: hidepid-inner-root.sh itself detected and reported that
  # the mount is denied in this runtime (it exits 0 after printing its
  # marker) — still a recognized skip, even though the namespace-creation
  # probe above succeeded. The caller only recognizes HIDEPID_SKIPPED=, so
  # the marker is translated here instead of being passed through as-is.
  echo "HIDEPID_SKIPPED=${mount_unavailable#HIDEPID_MOUNT_UNAVAILABLE=}"
elif [ "${status}" -eq 0 ]; then
  cat "${log}"
else
  # The probe already proved unshare/CAP_SYS_ADMIN works, and
  # hidepid-inner-root.sh never reported a recognized mount failure
  # either: whatever broke here (`su`, sourcing the lib, an assertion) is
  # a REAL bug this test must not silently swallow as "unavailable".
  cat "${log}" >&2
  rm -f "${log}"
  kill "${root_pid}" 2>/dev/null || true
  exit "${status}"
fi
rm -f "${log}"
kill "${root_pid}" 2>/dev/null || true
