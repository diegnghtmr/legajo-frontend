#!/usr/local/bin/bash
# Proves two things about identity derivation under `set -euo pipefail`
# (scripts/e2e-fullstack-in-docker.sh's own shell options), with `hostname`
# and `readlink` REPLACED by shims on PATH that always fail with no
# output (identity-derivation-shims/, mounted alongside this file) — a
# REAL failure, not a simulated one; `uname` is deliberately left
# working, since it must keep reporting the real kernel for the pidns
# case below to mean anything.
#
#   1. The RETIRED bare-assignment pattern this repo used before
#      (`OWNER_HOST="$(hostname 2>/dev/null)"`, no guard) ABORTS the whole
#      chain right there under `set -e`, before its own documented
#      `uname -n` fallback (or a loud ERROR) can ever run — literally
#      unreachable code. lib/fullstack-stale-reclaim.sh's own
#      current_owner_host does not abort, and actually reaches a real,
#      non-empty value through its `uname -n` fallback.
#   2. On a Linux kernel (confirmed by the real, un-shimmed `uname -s`),
#      an unreadable `readlink /proc/self/ns/pid` makes
#      current_owner_pidns return EMPTY — never the "none" sentinel,
#      which is reserved for a NON-Linux kernel where the concept doesn't
#      apply at all. Reproduces scripts/e2e-fullstack-in-docker.sh's own
#      WARNING block (kept in sync with it deliberately, not a
#      reimplementation of different logic) to prove the same
#      consequence it does: a warning is printed, the chain does NOT
#      abort, and the resulting empty pidns is exactly what
#      should_reclaim_stale_project's own comment says disables reclaim
#      for this run (proven directly, as its own case, in
#      same-user-cases.sh's EMPTY_THIS_PIDNS).
#
# Each reproduction below runs as a genuinely SEPARATE `bash -c` process,
# never a `(...)` subshell used as an `if`/`while` CONDITION: bash
# suspends `set -e` enforcement for the entire compound list a
# condition tests — even past an explicit `set -e` re-asserted INSIDE
# that subshell (verified empirically while writing this test: it does
# NOT restore enforcement) — so a subshell-as-condition could never
# actually prove an abort one way or the other. A genuinely separate
# `bash -c` child process has its own, independent, freshly-set shell
# options, so its real `set -e` behavior is what's under test; the
# PARENT temporarily disables its OWN `-e` (`set +e` / `set -e` around
# the single invocation) purely so a non-zero exit from that child is
# captured instead of aborting THIS script.
#
# Invoked by scripts/tests/fullstack-stale-reclaim.test.sh via
# `docker run ... bash:5.2 /support/identity-derivation-case.sh`.
set -euo pipefail

export PATH="/support/identity-derivation-shims:${PATH}"

# shellcheck source=../../../lib/fullstack-stale-reclaim.sh
. /workspace/scripts/lib/fullstack-stale-reclaim.sh
# So the separate `bash -c` child processes below can call them too —
# plain shell functions are NOT inherited by a child process on their
# own, only through this explicit export mechanism.
export -f current_owner_host
export -f current_owner_pidns

echo "=== old pattern (retired): hostname fails, no guard ==="
set +e
bash -c '
  set -euo pipefail
  OWNER_HOST="$(hostname 2>/dev/null)"
  if [ -z "${OWNER_HOST}" ]; then
    OWNER_HOST="$(uname -n 2>/dev/null)"
  fi
  echo "OLD_REACHED_FALLBACK=yes"
'
old_status=$?
set -e
if [ "${old_status}" -eq 0 ]; then
  echo "OLD_ABORTED=no"
else
  echo "OLD_ABORTED=yes"
fi

echo "=== new pattern: current_owner_host, same failing hostname ==="
set +e
bash -c '
  set -euo pipefail
  OWNER_HOST="$(current_owner_host)"
  echo "NEW_REACHED_FALLBACK=yes"
  if [ -n "${OWNER_HOST}" ]; then
    echo "NEW_OWNER_HOST_NONEMPTY=yes"
  else
    echo "NEW_OWNER_HOST_NONEMPTY=no"
  fi
'
new_status=$?
set -e
if [ "${new_status}" -eq 0 ]; then
  echo "NEW_ABORTED=no"
else
  echo "NEW_ABORTED=yes"
fi

echo "=== pidns: readlink fails on a real Linux kernel ==="
set +e
bash -c '
  set -euo pipefail
  OWNER_PIDNS="$(current_owner_pidns)"
  if [ -z "${OWNER_PIDNS}" ]; then
    echo "PIDNS_EMPTY=yes"
  else
    echo "PIDNS_EMPTY=no"
  fi
  # Reproduces scripts/e2e-fullstack-in-docker.sh'"'"'s own WARNING block —
  # kept in sync with it deliberately, so this proves the EXACT
  # consequence that script has, not just current_owner_pidns'"'"'s return
  # value in isolation.
  if [ -z "${OWNER_PIDNS}" ]; then
    echo "WARNING: could not determine this process'"'"'s own pid-namespace identity" >&2
    echo "  (readlink /proc/self/ns/pid was unreadable or empty on a Linux kernel," >&2
    echo "  where pid namespaces are real and this must never be papered over)." >&2
    echo "  Stale full-stack e2e project reclaim is DISABLED for this run only —" >&2
    echo "  it will not tear down a live concurrent run by mistake, but a" >&2
    echo "  genuinely stale project from an earlier run may need manual cleanup:" >&2
    echo "  docker compose -p <project> down --remove-orphans." >&2
    echo "WARNING_PRINTED=yes"
  else
    echo "WARNING_PRINTED=no"
  fi
  echo "PIDNS_CHAIN_REACHED=yes"
' 2>&1
pidns_status=$?
set -e
if [ "${pidns_status}" -eq 0 ]; then
  echo "PIDNS_ABORTED=no"
else
  echo "PIDNS_ABORTED=yes"
fi

echo "=== pidns: readlink AND uname both fail (kernel unknown) ==="
# An unknown kernel is NOT a confirmed non-Linux kernel: "none" is only
# safe where pid namespaces cannot exist, so a failing `uname -s` must
# still yield an EMPTY value (reclaim disabled), never the shared "none"
# sentinel two separate namespaces could both end up matching on.
set +e
PATH="/support/identity-derivation-shims-no-uname:${PATH}" bash -c '
  set -euo pipefail
  OWNER_PIDNS="$(current_owner_pidns)"
  if [ -z "${OWNER_PIDNS}" ]; then
    echo "UNKNOWN_KERNEL_PIDNS_EMPTY=yes"
  else
    echo "UNKNOWN_KERNEL_PIDNS_EMPTY=no (got: ${OWNER_PIDNS})"
  fi
'
unknown_kernel_status=$?
set -e
if [ "${unknown_kernel_status}" -eq 0 ]; then
  echo "UNKNOWN_KERNEL_ABORTED=no"
else
  echo "UNKNOWN_KERNEL_ABORTED=yes"
fi
