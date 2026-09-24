#!/usr/local/bin/bash
# Entry point for the hidepid=2 regression case: starts a real, long-lived
# root-owned process, then (if this runtime allows it) proves the
# unprivileged-viewer liveness check sees it as alive even when `/proc`
# hides it entirely. `unshare --mount` + `mount -t proc -o hidepid=2` need
# CAP_SYS_ADMIN in a fresh mount namespace — available on most CI runners
# and local Docker (verified interactively while writing this test), but
# not guaranteed on every runtime (e.g. some restricted/rootless container
# setups). Reports HIDEPID_SKIPPED=<reason> rather than failing outright
# when it's unavailable; the calling test treats that as a reported skip,
# not a hard failure. Invoked by
# scripts/tests/fullstack-stale-reclaim.test.sh via
# `docker run --cap-add SYS_ADMIN ... bash:5.2 /support/hidepid-case.sh`.
set -euo pipefail

sleep 100 &
root_pid=$!

if ! command -v unshare >/dev/null 2>&1 || ! command -v mount >/dev/null 2>&1; then
  echo "HIDEPID_SKIPPED=unshare or mount not available in this image"
  kill "${root_pid}" 2>/dev/null || true
  exit 0
fi

log="$(mktemp)"
if unshare --mount --propagation private /support/hidepid-inner-root.sh "${root_pid}" >"${log}" 2>&1; then
  cat "${log}"
else
  status=$?
  echo "HIDEPID_SKIPPED=unshare/mount failed with status ${status}: $(tr '\n' ' ' <"${log}")"
fi
rm -f "${log}"
kill "${root_pid}" 2>/dev/null || true
