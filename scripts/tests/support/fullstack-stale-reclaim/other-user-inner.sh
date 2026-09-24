#!/usr/local/bin/bash
# Runs as the unprivileged `nobody` user, invoked by other-user-case.sh.
# $1 is the real, still-running PID of a process owned by root (a
# DIFFERENT user than this one) — `kill -0` against it fails with EPERM,
# never ESRCH.
set -euo pipefail
root_pid="$1"

# A deliberate LOCAL reimplementation of the RETIRED naive check — bare
# `kill -0` exit code, no error-text classification at all.
# scripts/lib/fullstack-stale-reclaim.sh no longer works this way; this
# exists only so this test keeps proving why: EPERM and ESRCH both just
# read as "nonzero" to a check that never looks at the error text.
old_kill0_is_alive() {
  kill -0 "$1" 2>/dev/null
}
if old_kill0_is_alive "${root_pid}"; then
  echo "OLD_CHECK=alive"
else
  echo "OLD_CHECK=dead"
fi

# shellcheck source=../../../lib/fullstack-stale-reclaim.sh
. /workspace/scripts/lib/fullstack-stale-reclaim.sh

if pid_is_alive "${root_pid}"; then
  echo "CLASS_EPERM=alive"
else
  echo "CLASS_EPERM=dead"
fi
if should_reclaim_stale_project "${root_pid}" host-a host-a; then
  echo "OTHER_USER=reclaimed"
else
  echo "OTHER_USER=untouched"
fi
