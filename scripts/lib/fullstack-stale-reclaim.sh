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

# Prints this process's own hostname to stdout (`hostname`, falling back
# to `uname -n` when that command is missing or fails), or nothing at all
# if BOTH fail — the caller decides what an empty result means (this
# file's own callers never abort on it; scripts/e2e-fullstack-in-docker.sh
# treats it as a hard, loud failure since it is the one place that
# EXPORTS this run's identity for everyone else to trust). Defined ONCE
# here so the production script and every test helper that needs "this
# run's own host label" for real derive it the SAME way, instead of three
# independently written copies drifting apart.
#
# Every internal assignment below is deliberately allowed to fail
# (`|| true`): under the caller's OWN `set -e` (this function runs in the
# CALLER's shell, not a subshell, since it is sourced, not `$(...)`'d), a
# plain `var="$(cmd)"` assignment that fails aborts the WHOLE script right
# there — before this function could ever reach its own fallback. `|| true`
# is what keeps this function's own fallback chain reachable regardless of
# the caller's shell options.
current_owner_host() {
  local host
  host="$(hostname 2>/dev/null)" || true
  if [ -z "${host}" ]; then
    host="$(uname -n 2>/dev/null)" || true
  fi
  printf '%s' "${host}"
}

# Prints this process's own pid-namespace identity to stdout: the real
# `readlink /proc/self/ns/pid` value (e.g. "pid:[4026531836]") on a system
# that has one, or nothing at all when it's unreadable/empty — EXCEPT on a
# non-Linux kernel (`uname -s` != "Linux", e.g. macOS), which has no pid
# namespaces at all, where it prints the literal "none" instead: there is
# only one flat pid space on such a system, so every process's identity is
# trivially the SAME one, and "none" == "none" is exactly as correct there
# as a real pidns match is everywhere else.
#
# On LINUX, an unreadable/empty pidns is NEVER papered over with "none":
# two containers in SEPARATE, real pid namespaces on a system where
# `/proc/self/ns/pid` happens to be unreadable for either of them would
# otherwise both collapse to the SAME sentinel and start matching each
# other — reintroducing exactly the destructive bug pidns matching exists
# to prevent, just moved one level up. Printing nothing here is what lets
# should_reclaim_stale_project's own "this run's own pidns identity is
# unknown" check (see its comment) refuse to reclaim ANYTHING for a run
# whose identity it cannot positively establish — the safe direction,
# never a silent, incorrect match. Same fallback-reachability reasoning as
# current_owner_host above: every internal assignment is `|| true`-guarded.
current_owner_pidns() {
  local pidns kernel
  pidns="$(readlink /proc/self/ns/pid 2>/dev/null)" || true
  if [ -n "${pidns}" ]; then
    printf '%s' "${pidns}"
    return
  fi
  kernel="$(uname -s 2>/dev/null)" || true
  # "none" only for a kernel `uname -s` positively reports as non-Linux:
  # an empty or failing `uname` is an UNKNOWN kernel, not a confirmed
  # non-Linux one, so it gets the same empty value as Linux below.
  if [ -n "${kernel}" ] && [ "${kernel}" != "Linux" ]; then
    printf '%s' "none"
  fi
  # else: empty/unreadable pidns ON LINUX (or on a kernel `uname` could
  # not name) — print nothing (empty), on purpose; see this function's
  # own comment above for why.
}

# True (exit 0) when owner_host/owner_pidns positively match
# this_host/this_pidns — every one of the four must be non-empty, and
# both pairs must be equal. False (exit 1) in every other case, including
# when either side of either pair is empty. Shared by
# should_reclaim_stale_project (as part of its full reclaim decision) and
# cleanup_stale_fullstack_projects (to tell a genuinely alive-and-matched
# project apart from one skipped specifically for an identity mismatch,
# worth its own explanatory log line, without re-deriving this same
# comparison a second, independent way).
owner_identity_matches() {
  local owner_host="$1" owner_pidns="$2" this_host="$3" this_pidns="$4"
  if [ -z "${owner_host}" ] || [ -z "${this_host}" ] || [ "${owner_host}" != "${this_host}" ]; then
    return 1
  fi
  if [ -z "${owner_pidns}" ] || [ -z "${this_pidns}" ] || [ "${owner_pidns}" != "${this_pidns}" ]; then
    return 1
  fi
  return 0
}

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
  # A PID only means something within the exact (host, pid namespace)
  # that assigned it: an unknown identity — on either side — is never
  # positively matched.
  if ! owner_identity_matches "${owner_host}" "${owner_pidns}" "${this_host}" "${this_pidns}"; then
    return 1
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
      # A project with OUR OWN prefix that is being left untouched
      # specifically because its host/pidns identity is missing or
      # doesn't match this run's own (as opposed to: it's genuinely still
      # alive, which needs no explanation) would otherwise just silently
      # keep sitting there, holding its ports, with no clue why THIS run
      # never reclaimed it. `owner_identity_matches` is the exact same
      # check `should_reclaim_stale_project` itself just used, so this
      # never disagrees with the reclaim decision above it explains.
      if ! owner_identity_matches "${owner_host}" "${owner_pidns}" \
        "${LEGAJO_FULLSTACK_E2E_OWNER_HOST}" "${LEGAJO_FULLSTACK_E2E_OWNER_PIDNS}"; then
        echo "==> leaving full-stack e2e project '${project}' untouched: its host/pidns identity is missing or does not match this run's own — if it is a genuine leftover from an old run, remove it manually: docker compose -p ${project} down --remove-orphans"
      fi
      continue
    fi

    echo "==> reclaiming stale full-stack e2e project '${project}' (owner PID ${owner_pid} on ${owner_host}, pidns ${owner_pidns}, is no longer running)"
    docker compose -p "${project}" -f "${COMPOSE_FILE}" -f "${COMPOSE_LABEL_FILE}" down --remove-orphans || true
  done < <(docker compose ls --all -q 2>/dev/null)
}
