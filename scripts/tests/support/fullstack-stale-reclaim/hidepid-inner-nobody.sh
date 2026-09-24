#!/usr/local/bin/bash
# Runs as the unprivileged `nobody` user, inside a mount namespace whose
# `/proc` was just mounted with `hidepid=2` by hidepid-inner-root.sh — the
# exact condition under which a process this viewer may not `ptrace` has
# NO visible `/proc/<pid>` entry at all. $1 is the real, still-running
# root-owned PID from outside this namespace.
set -euo pipefail
root_pid="$1"

# A deliberate LOCAL reimplementation of the RETIRED /proc-existence
# liveness check — scripts/lib/fullstack-stale-reclaim.sh no longer
# defines this at all; it exists only here, to keep proving why it was
# replaced.
old_proc_is_alive() {
  [ -d "/proc/$1" ]
}
if old_proc_is_alive "${root_pid}"; then
  echo "OLD_PROC_CHECK=alive"
else
  echo "OLD_PROC_CHECK=dead"
fi

# shellcheck source=../../../lib/fullstack-stale-reclaim.sh
. /workspace/scripts/lib/fullstack-stale-reclaim.sh
if pid_is_alive "${root_pid}"; then
  echo "NEW_CHECK=alive"
else
  echo "NEW_CHECK=dead"
fi
