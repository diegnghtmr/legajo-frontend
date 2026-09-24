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
# host — regardless of which user owns it. The PREVIOUS check here was
# `kill -0 "$pid"`, which is wrong for this purpose: `kill -0` asks the
# kernel "may I send this PID a signal", which fails with EPERM for a PID
# that DOES exist but is owned by a different user — indistinguishable,
# from the exit code alone, from the PID not existing at all (ESRCH). A
# stale-project reclaim that treats EPERM the same as ESRCH would tear
# down a LIVE concurrent run started by another user on a shared runner or
# dev box: the destructive bug this helper exists to fix.
#
# `/proc/$pid` existing is a direct, permission-free existence check on
# Linux: `/proc/<pid>` directories are world-readable+searchable
# (`dr-xr-xr-x`) regardless of who owns the process, so `[ -d ... ]`
# answers "does it exist" without ever touching the "may I signal it"
# question `kill -0` actually asks. `ps -p` is the portable fallback for a
# system with no `/proc` — this project only ever runs these scripts
# inside Linux containers (this repo's own rule), where `/proc` always
# exists, so that branch is a defensive guard, never exercised in
# practice; it too can see another user's processes, it only restricts
# some of the DETAILS `ps` would otherwise print about them, never bare
# existence.
pid_is_alive() {
  local pid="$1"
  if [ -d /proc ]; then
    [ -d "/proc/${pid}" ]
  else
    ps -p "${pid}" >/dev/null 2>&1
  fi
}

# True (exit 0) when the stale-project candidate identified by
# owner_pid/owner_host should be reclaimed (torn down) by this run; false
# (exit 1) when it must be left untouched. Pure decision logic with no
# `docker` calls of its own, so it is unit-testable directly, independent
# of `cleanup_stale_fullstack_projects`'s own Compose/`docker ps` plumbing.
should_reclaim_stale_project() {
  local owner_pid="$1"
  local owner_host="$2"
  local this_host="$3"

  if [ -z "${owner_pid}" ]; then
    return 1 # no ownership label at all: not something this check can safely judge
  fi
  # A positive integer only. Anything else — empty, non-numeric, a
  # negative number — is either a corrupted label or a value
  # `pid_is_alive` was never meant to receive; treating it as "unknown"
  # (never reclaimed) is the safe direction for a label this check cannot
  # trust.
  case "${owner_pid}" in
    '' | *[!0-9]*) return 1 ;;
  esac
  if [ -z "${owner_host}" ]; then
    return 1 # an empty owner host can never be positively matched to this host
  fi
  if [ "${owner_host}" != "${this_host}" ]; then
    return 1 # a PID only means something on the host that assigned it
  fi
  if pid_is_alive "${owner_pid}"; then
    return 1 # owner still running: a live concurrent run, never touched
  fi
  return 0
}

# Reclaims (tears down) every Compose project left behind by a run of
# scripts/e2e-fullstack-in-docker.sh whose owner process is provably gone.
# Reads COMPOSE_PROJECT (the project THIS run owns, always skipped),
# COMPOSE_FILE, COMPOSE_LABEL_FILE, and LEGAJO_FULLSTACK_E2E_OWNER_HOST
# from the caller's environment — the same globals
# scripts/e2e-fullstack-in-docker.sh already sets for its own use, so this
# function reads them rather than re-deriving them.
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
    local labels="" owner_pid="" owner_host=""
    IFS= read -r labels < <(docker ps -a --filter "label=com.docker.compose.project=${project}" \
      --format '{{.Label "legajo.fullstack-e2e.owner-pid"}}|{{.Label "legajo.fullstack-e2e.owner-host"}}') || true
    owner_pid="${labels%%|*}"
    owner_host="${labels#*|}"

    if ! should_reclaim_stale_project "${owner_pid}" "${owner_host}" "${LEGAJO_FULLSTACK_E2E_OWNER_HOST}"; then
      continue
    fi

    echo "==> reclaiming stale full-stack e2e project '${project}' (owner PID ${owner_pid} on ${owner_host} is no longer running)"
    docker compose -p "${project}" -f "${COMPOSE_FILE}" -f "${COMPOSE_LABEL_FILE}" down --remove-orphans || true
  done < <(docker compose ls --all -q 2>/dev/null)
}
