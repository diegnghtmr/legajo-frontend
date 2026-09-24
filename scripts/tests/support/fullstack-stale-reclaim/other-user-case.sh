#!/usr/local/bin/bash
# Runs as root: starts a real, long-lived process, then hands its PID to
# other-user-inner.sh, run as the unprivileged `nobody` user (this
# image's `su` can drop to it directly, no sudo/setuid needed) — the one
# case `kill -0`'s bare exit code gets wrong (EPERM, not ESRCH). Invoked
# by scripts/tests/fullstack-stale-reclaim.test.sh via
# `docker run ... bash:5.2 /support/other-user-case.sh`.
set -euo pipefail

sleep 100 &
root_pid=$!
su -s /usr/local/bin/bash nobody /support/other-user-inner.sh "${root_pid}"
kill "${root_pid}" 2>/dev/null || true
