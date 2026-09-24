#!/usr/local/bin/bash
# Runs (as root, the container's default user) every should_reclaim_stale_project
# case that needs no privilege drop and no second host label: a dead
# owner, a live owner checked by the SAME user, a live owner on a
# DIFFERENT host label, a dead owner in a DIFFERENT pid namespace, a dead
# owner with no pidns label at all (a legacy/unlabeled project), a dead
# owner whose label HAS a pidns but THIS run's own pidns is empty, several
# malformed owner-PID/host labels, and direct pid_is_alive classification
# checks (a confirmed success, a confirmed ESRCH, and an out-of-range PID
# that fails for neither reason). Invoked by
# scripts/tests/fullstack-stale-reclaim.test.sh via
# `docker run ... bash:5.2 /support/same-user-cases.sh`.
set -euo pipefail

# shellcheck source=../../../lib/fullstack-stale-reclaim.sh
. /workspace/scripts/lib/fullstack-stale-reclaim.sh

# This container's own REAL pid-namespace identity, derived the SAME way
# scripts/e2e-fullstack-in-docker.sh derives it — via the shared helper,
# never a second, independently written copy of the same
# readlink/uname logic — used as THIS_PIDNS below, and (unmodified) as a
# MATCHING owner_pidns in every case that should behave exactly as it did
# before pidns existed as a concept.
THIS_PIDNS="$(current_owner_pidns)"

# Case: owner dead. A real PID, started and then killed and `wait`-ed on
# inside THIS container. `wait` on a shell's own background job both
# blocks until it has exited AND reaps it (this shell IS its parent), so
# by the time `wait` returns, `kill -0` against that PID already reports
# "No such process" — no polling loop needed, verified empirically while
# writing this test.
sleep 100 &
dead_pid=$!
kill "${dead_pid}"
wait "${dead_pid}" 2>/dev/null || true
if should_reclaim_stale_project "${dead_pid}" "host-a" "${THIS_PIDNS}" "host-a" "${THIS_PIDNS}"; then
  echo "DEAD=reclaimed"
else
  echo "DEAD=untouched"
fi

# Classification: pid_is_alive on that same, now-confirmed-reaped PID
# must report ESRCH ("No such process"), the one text this check treats
# as dead.
if pid_is_alive "${dead_pid}"; then
  echo "CLASS_ESRCH=alive"
else
  echo "CLASS_ESRCH=dead"
fi

# Case: the SAME dead PID and host as above, but the label names a
# DIFFERENT pid namespace than this checker's own — must be left
# untouched. This is the destructive scenario a hostname-only identity
# gets wrong: two containers sharing this host's Docker socket, with the
# SAME hostname but SEPARATE pid namespaces, would otherwise see each
# other's live PID as ESRCH (dead, in THIS namespace) and reclaim it. The
# owner PID is genuinely dead HERE, so this case isolates the pidns
# check itself from liveness: reclaim must be blocked by the pidns
# mismatch alone, not merely coincide with a dead PID's own outcome.
if should_reclaim_stale_project "${dead_pid}" "host-a" "${THIS_PIDNS}-different" "host-a" "${THIS_PIDNS}"; then
  echo "DIFFERENT_PIDNS=reclaimed"
else
  echo "DIFFERENT_PIDNS=untouched"
fi

# Case: the SAME dead PID and host again, but NO pidns label at all — a
# legacy project from before this label existed, or a Compose project
# whose labels were otherwise never applied. Must be left untouched, the
# same as an unlabeled/legacy project with no host label already was.
if should_reclaim_stale_project "${dead_pid}" "host-a" "" "host-a" "${THIS_PIDNS}"; then
  echo "MISSING_PIDNS_LABEL=reclaimed"
else
  echo "MISSING_PIDNS_LABEL=untouched"
fi

# Case: the SAME dead PID, matching host, and a genuine (non-empty) owner
# pidns label — but THIS run's OWN pidns is empty (e.g.
# current_owner_pidns couldn't read /proc/self/ns/pid on Linux; see its
# own comment). Must be left untouched: a run that cannot positively
# establish its OWN identity has nothing safe to match anything against,
# regardless of how well-formed the OTHER project's label looks.
if should_reclaim_stale_project "${dead_pid}" "host-a" "${THIS_PIDNS}" "host-a" ""; then
  echo "EMPTY_THIS_PIDNS=reclaimed"
else
  echo "EMPTY_THIS_PIDNS=untouched"
fi

# Case: owner alive, same (root) user as the checker. Also doubles as the
# "kill -0 succeeds outright" classification case.
sleep 100 &
live_pid=$!
if pid_is_alive "${live_pid}"; then
  echo "CLASS_SUCCESS=alive"
else
  echo "CLASS_SUCCESS=dead"
fi
if should_reclaim_stale_project "${live_pid}" "host-a" "${THIS_PIDNS}" "host-a" "${THIS_PIDNS}"; then
  echo "OWN_LIVE=reclaimed"
else
  echo "OWN_LIVE=untouched"
fi
kill "${live_pid}" 2>/dev/null || true

# Case: a genuinely live PID, but the label names a DIFFERENT host than
# this one — must be left untouched regardless of liveness.
sleep 100 &
other_host_pid=$!
if should_reclaim_stale_project "${other_host_pid}" "some-other-host" "${THIS_PIDNS}" "host-a" "${THIS_PIDNS}"; then
  echo "OTHER_HOST=reclaimed"
else
  echo "OTHER_HOST=untouched"
fi
kill "${other_host_pid}" 2>/dev/null || true

# Cheap malformed-label cases: none of these should ever reach a liveness
# check at all, so no real PID is needed for them.
if should_reclaim_stale_project "" "host-a" "${THIS_PIDNS}" "host-a" "${THIS_PIDNS}"; then
  echo "EMPTY_PID=reclaimed"
else
  echo "EMPTY_PID=untouched"
fi
if should_reclaim_stale_project "not-a-pid" "host-a" "${THIS_PIDNS}" "host-a" "${THIS_PIDNS}"; then
  echo "NON_NUMERIC_PID=reclaimed"
else
  echo "NON_NUMERIC_PID=untouched"
fi
# PID 0 never names a real process; a leading zero ("007") is either a
# corrupted label or a value never meant to be parsed as a PID.
if should_reclaim_stale_project "0" "host-a" "${THIS_PIDNS}" "host-a" "${THIS_PIDNS}"; then
  echo "ZERO_PID=reclaimed"
else
  echo "ZERO_PID=untouched"
fi
if should_reclaim_stale_project "007" "host-a" "${THIS_PIDNS}" "host-a" "${THIS_PIDNS}"; then
  echo "LEADING_ZERO_PID=reclaimed"
else
  echo "LEADING_ZERO_PID=untouched"
fi
if should_reclaim_stale_project "1" "" "${THIS_PIDNS}" "host-a" "${THIS_PIDNS}"; then
  echo "EMPTY_HOST=reclaimed"
else
  echo "EMPTY_HOST=untouched"
fi

# Classification: an out-of-range PID (2^31, one past the signed 32-bit
# range bash's own `kill` builtin represents a PID in) fails with neither
# ESRCH nor EPERM — bash itself rejects the argument as unparseable
# ("arguments must be process or job IDs", verified empirically in this
# exact image while writing this test), a message pid_is_alive's case
# match does not recognize at all. This proves the check's own
# fail-safe direction for real: an error it cannot classify as a
# confirmed "no such process" is still treated as ALIVE, not dead.
if pid_is_alive 2147483648; then
  echo "CLASS_UNRECOGNIZED_ERROR=alive"
else
  echo "CLASS_UNRECOGNIZED_ERROR=dead"
fi
