#!/usr/bin/env bash
# Shared stale-project reclaim logic for
# scripts/e2e-fullstack-in-docker.sh's `cleanup_stale_fullstack_projects`,
# extracted into its own sourced file so it can be exercised directly by
# scripts/tests/fullstack-stale-reclaim.test.sh (with `docker` stubbed on
# `PATH`) without needing to run the full e2e-fullstack-in-docker.sh script
# end to end.

# Shared prefix for every Compose project name this script creates.
# Defined ONCE here so scripts/e2e-fullstack-in-docker.sh's own
# COMPOSE_PROJECT construction and this file's reclaim filter (below) can
# never drift apart the way two independently written literals could.
COMPOSE_PROJECT_PREFIX="legajo-frontend-fullstack-e2e-"

# True (exit 0) when a process with this PID currently exists on THIS
# host — regardless of which user owns it, and regardless of whether
# `/proc` reflects it at all. Two previous versions of this check were
# both wrong about that: `kill -0 "$pid"`'s bare EXIT CODE conflates "no
# such process" (ESRCH) with "exists, but I may not signal it" (EPERM) —
# a live process owned by a different user reads as dead. Reading
# `/proc/$pid` existence instead fixed that specific case, but is ALSO
# wrong on a host where `/proc` is mounted with `hidepid=1`/`hidepid=2`/
# `hidepid=invisible` (a real, supported Linux mount option): under that
# option, a process an unprivileged viewer may not `ptrace` has NO visible
# `/proc/<pid>` entry at all, even though it is very much alive — the
# exact same destructive outcome, through a different mechanism. (Some
# systems, e.g. macOS, have no `/proc` at all.)
#
# The one signal that actually distinguishes "no such process" from every
# OTHER reason a signal could fail is `kill -0`'s own error TEXT: the
# kernel reports ESRCH ("No such process") only when the PID genuinely
# does not exist, and a different error (most commonly EPERM, "Operation
# not permitted") when it exists but this caller may not signal it — and
# that distinction is read straight from kill(2)'s own errno, never
# through `/proc`, so `hidepid` cannot hide it. `LC_ALL=C` keeps the
# message in the one language this case match checks for, regardless of
# the caller's own locale. Any failure OTHER than a confirmed "No such
# process" — EPERM, or a message this check does not recognize at all —
# is treated as ALIVE: the safe direction when this check cannot
# positively prove the process is gone.
pid_is_alive() {
  local pid="$1"
  local kill_stderr
  if kill_stderr="$(LC_ALL=C kill -0 "${pid}" 2>&1 1>/dev/null)"; then
    return 0
  fi
  case "${kill_stderr}" in
    *"No such process"*) return 1 ;;
    *) return 0 ;;
  esac
}

# True (exit 0) when the stale-project candidate identified by
# owner_pid/owner_host/owner_pidns should be reclaimed (torn down) by
# this run; false (exit 1) when it must be left untouched. Pure decision
# logic with no `docker` calls of its own, so it is unit-testable
# directly, independent of `cleanup_stale_fullstack_projects`'s own
# Compose/`docker ps` plumbing.
#
# A PID only means something within the PID NAMESPACE that assigned it —
# hostname (a UTS identity) is a DIFFERENT, coarser thing: two containers
# sharing this host's Docker socket, with the SAME hostname label but
# SEPARATE pid namespaces, each see PID NUMBERS from a completely
# independent allocation. Matching on host alone, a live owner PID in
# ANOTHER namespace reads as ESRCH ("no such process") from THIS
# namespace's own `kill -0` — indistinguishable from genuinely dead — and
# would be reclaimed while very much alive. Requiring host AND pidns to
# BOTH match, and both be non-empty, closes that: an unlabeled or legacy
# project (no pidns label at all — it predates this check) is left
# untouched, exactly like an unlabeled or legacy project with no host
# label already was.
should_reclaim_stale_project() {
  local owner_pid="$1"
  local owner_host="$2"
  local owner_pidns="$3"
  local this_host="$4"
  local this_pidns="$5"

  if [ -z "${owner_pid}" ]; then
    return 1 # no ownership label at all: not something this check can safely judge
  fi
  # Accept only a positive integer with no leading zero — "0" never names
  # a real process (PID 0 is not a real process id the kernel would ever
  # report as this run's OWN owner), and a leading zero ("007") is either
  # a corrupted label or a value this check has no business parsing as a
  # PID at all. Checked in two passes because a single case pattern like
  # "[1-9][0-9]*" only anchors its first couple of characters — its own
  # trailing "*" still matches any remaining characters, digits or not.
  case "${owner_pid}" in
    [1-9]*) ;;
    *) return 1 ;;
  esac
  case "${owner_pid}" in
    *[!0-9]*) return 1 ;;
  esac
  if [ -z "${owner_host}" ]; then
    return 1 # an empty owner host can never be positively matched to this host
  fi
  if [ "${owner_host}" != "${this_host}" ]; then
    return 1 # a PID only means something on the host that assigned it
  fi
  if [ -z "${owner_pidns}" ]; then
    return 1 # no pidns label at all (unlabeled or a project from before this label existed): never reclaimed
  fi
  if [ -z "${this_pidns}" ]; then
    return 1 # this run's own pidns identity is unknown: nothing can be positively matched against it
  fi
  if [ "${owner_pidns}" != "${this_pidns}" ]; then
    return 1 # a PID only means something within the pid namespace that assigned it
  fi
  if pid_is_alive "${owner_pid}"; then
    return 1 # owner still running: a live concurrent run, never touched
  fi
  return 0
}

# Reclaims (tears down) every Compose project left behind by a run of
# scripts/e2e-fullstack-in-docker.sh whose owner process is provably gone.
# Reads COMPOSE_PROJECT (the project THIS run owns, always skipped),
# COMPOSE_FILE, COMPOSE_LABEL_FILE, LEGAJO_FULLSTACK_E2E_OWNER_HOST, and
# LEGAJO_FULLSTACK_E2E_OWNER_PIDNS from the caller's environment — the
# same globals scripts/e2e-fullstack-in-docker.sh already sets for its own
# use, so this function reads them rather than re-deriving them.
cleanup_stale_fullstack_projects() {
  local project
  while IFS= read -r project; do
    [ -z "${project}" ] && continue
    case "${project}" in
      "${COMPOSE_PROJECT_PREFIX}"*) ;;
      *) continue ;;
    esac
    [ "${project}" = "${COMPOSE_PROJECT}" ] && continue

    # Read only the FIRST line of `docker ps -a`'s output without piping
    # through `head -n1`: under `set -o pipefail` (the caller's own
    # options), `docker ps` receiving SIGPIPE from a downstream `head`
    # closing early can make the PIPELINE's exit status non-zero even
    # though `head` itself succeeded — a spurious failure this function
    # must not have. Reading from a process substitution instead means
    # `read`'s own exit status is what this command sees; the producer
    # process is not part of a pipeline `pipefail` inspects.
    local labels="" owner_pid="" owner_host="" owner_pidns="" rest=""
    IFS= read -r labels < <(docker ps -a --filter "label=com.docker.compose.project=${project}" \
      --format '{{.Label "legajo.fullstack-e2e.owner-pid"}}|{{.Label "legajo.fullstack-e2e.owner-host"}}|{{.Label "legajo.fullstack-e2e.owner-pidns"}}') || true
    owner_pid="${labels%%|*}"
    rest="${labels#*|}"
    owner_host="${rest%%|*}"
    owner_pidns="${rest#*|}"

    if ! should_reclaim_stale_project "${owner_pid}" "${owner_host}" "${owner_pidns}" \
      "${LEGAJO_FULLSTACK_E2E_OWNER_HOST}" "${LEGAJO_FULLSTACK_E2E_OWNER_PIDNS}"; then
      continue
    fi

    echo "==> reclaiming stale full-stack e2e project '${project}' (owner PID ${owner_pid} on ${owner_host}, pidns ${owner_pidns}, is no longer running)"
    docker compose -p "${project}" -f "${COMPOSE_FILE}" -f "${COMPOSE_LABEL_FILE}" down --remove-orphans || true
  done < <(docker compose ls --all -q 2>/dev/null)
}
