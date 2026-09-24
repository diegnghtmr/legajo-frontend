#!/usr/bin/env bash
# Runs the full-stack e2e suite (F3, TRD §14.3/1.3.11: no `page.route`
# mocks anywhere) against a real Compose stack: brings up `backend` +
# `frontend` from the sibling backend repository's `docker-compose.yml`
# (task K4), building the frontend from THIS checkout, runs
# `npm run e2e:fullstack` inside the same pinned Playwright image
# scripts/e2e-in-docker.sh uses, always tears the stack down (trap, so a
# failure never leaks containers), and propagates Playwright's own exit
# status — never masked by `docker compose down`'s (the same class of bug
# the backend repo's README smoke block hit and fixed with the same
# `set -e` + `EXIT` trap shape used below).
#
# Usage: scripts/e2e-fullstack-in-docker.sh
#
# Env:
#   LEGAJO_BACKEND_DIR     path to the sibling backend checkout that owns
#                          docker-compose.yml (default: ../backend, resolved
#                          against this repo's root, not the caller's cwd).
#   E2E_BASE_URL           frontend origin Playwright navigates to
#                          (default: http://localhost:${LEGAJO_FRONTEND_PORT
#                          :-80}, TRD §14.2 Compose `frontend` port).
#   LEGAJO_FRONTEND_PORT   host port the backend Compose file publishes
#                          `frontend` on (default: 80, read by that file
#                          directly — this script only reads it to check the
#                          port and build the E2E_BASE_URL default).
#   E2E_BACKEND_BASE_URL   backend origin the specs call directly
#                          (default: http://localhost:8080).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RAW_BACKEND_DIR="${LEGAJO_BACKEND_DIR:-../backend}"

# Resolves relative to THIS repo's root, not the caller's current directory,
# so `scripts/e2e-fullstack-in-docker.sh` behaves identically whether it's
# invoked from the repo root, a subdirectory, or CI's own working directory.
# Fails clearly and immediately if the resolved path has no
# docker-compose.yml, instead of letting `docker compose` fail three steps
# later with a generic "no such file" that doesn't name the env var to fix.
case "${RAW_BACKEND_DIR}" in
  /*) BACKEND_DIR="${RAW_BACKEND_DIR}" ;;
  *) BACKEND_DIR="${REPO_DIR}/${RAW_BACKEND_DIR}" ;;
esac
BACKEND_DIR="$(cd "${BACKEND_DIR}" 2>/dev/null && pwd || true)"

if [ -z "${BACKEND_DIR}" ] || [ ! -f "${BACKEND_DIR}/docker-compose.yml" ]; then
  echo "ERROR: could not find the backend checkout's docker-compose.yml." >&2
  echo "  LEGAJO_BACKEND_DIR='${RAW_BACKEND_DIR}' (resolved against '${REPO_DIR}')." >&2
  echo "  Set LEGAJO_BACKEND_DIR to the sibling backend repository's path" >&2
  echo "  (default: ../backend). In CI, the fullstack-e2e job in" >&2
  echo "  .github/workflows/frontend.yml checks out diegnghtmr/legajo-backend" >&2
  echo "  to the local path 'legajo-backend' and points this script at it." >&2
  exit 1
fi

# shellcheck source=lib/fullstack-stale-reclaim.sh
source "${SCRIPT_DIR}/lib/fullstack-stale-reclaim.sh"

COMPOSE_FILE="${BACKEND_DIR}/docker-compose.yml"
# An explicit Compose project name — never Compose's own default (derived
# from the compose file's directory name, e.g. "backend" for a checkout at
# .../backend). Without this, a developer's own, independently started
# `docker compose up` in that same backend checkout (same directory, same
# default project name) would be the SAME Compose project as this script's
# own stack: `docker compose down` below would then tear down whatever the
# developer left running, not just what this run started.
#
# UNIQUE per run, not a second fixed name, so two overlapping runs of THIS
# script (two developers, or two CI jobs) don't collide with each other the
# same way: a fixed name would let the second run's `docker compose down`
# tear down the first run's still-in-progress stack. The default is this
# process's own PID, which cannot collide between two processes running at
# once on the same host/runner; LEGAJO_FULLSTACK_E2E_PROJECT overrides it
# for a caller that wants a stable, predictable name instead (e.g. to
# `docker compose logs` a specific run by name). Since `-p` below always
# scopes teardown to exactly this variable's value, a unique name is also
# what keeps teardown from ever touching a DIFFERENT run's resources — the
# scoping mechanism doesn't change, only the value fed into it does.
COMPOSE_PROJECT="${LEGAJO_FULLSTACK_E2E_PROJECT:-${COMPOSE_PROJECT_PREFIX}$$}"
# The backend Compose file's `frontend` service builds from
# `${LEGAJO_FRONTEND_DIR:-../frontend}` (task K4); pointing it at THIS
# checkout is what makes the full-stack stack test the frontend under
# review, not whatever `../frontend` happens to resolve to relative to the
# backend checkout.
export LEGAJO_FRONTEND_DIR="${REPO_DIR}"

# Consumed by scripts/docker/fullstack-e2e-labels.override.yml (see its own
# comment): stamps every container THIS run creates with its owning PID,
# host, and pid namespace, so a LATER run can tell a stale project (owner
# gone) apart from a live concurrent one (owner still running) — see
# cleanup_stale_fullstack_projects below.
export LEGAJO_FULLSTACK_E2E_OWNER_PID="$$"

# Assigned in a PLAIN statement, never `export VAR="$(cmd)"` directly:
# `export`'s OWN exit status always succeeds regardless of whether the
# command substitution assigned to it failed, so a failing or empty
# `hostname` would silently export an EMPTY label instead of being caught
# here — and cleanup_stale_fullstack_projects's own
# should_reclaim_stale_project treats an empty owner/this host as "can
# never be positively matched," which would quietly disable reclaim for
# every future run on this host, not loudly fail this one. `uname -n` is
# the fallback when `hostname` itself is missing or fails; if BOTH come up
# empty, this is a hard, loud failure, not a silent empty label.
OWNER_HOST="$(hostname 2>/dev/null)"
if [ -z "${OWNER_HOST}" ]; then
  OWNER_HOST="$(uname -n 2>/dev/null)"
fi
if [ -z "${OWNER_HOST}" ]; then
  echo "ERROR: could not determine this host's own hostname (both 'hostname'" >&2
  echo "  and 'uname -n' failed or returned empty)." >&2
  echo "  scripts/e2e-fullstack-in-docker.sh needs a non-empty host identity to" >&2
  echo "  label this run's Compose containers, so a LATER run can tell a dead" >&2
  echo "  run's project apart from a live one — see" >&2
  echo "  lib/fullstack-stale-reclaim.sh's own should_reclaim_stale_project" >&2
  echo "  comment for why an empty host label is never trusted." >&2
  exit 1
fi
export LEGAJO_FULLSTACK_E2E_OWNER_HOST="${OWNER_HOST}"

# The PID NAMESPACE this process itself belongs to. Hostname (a UTS
# identity) alone is NOT enough to say two runs share the same VIEW of
# process ids: two containers sharing this host's Docker socket, with the
# SAME hostname label (nothing here randomizes it) but SEPARATE pid
# namespaces, would each see the OTHER's live owner PID as ESRCH ("no such
# process" — IN THIS NAMESPACE) and reclaim a live run out from under it.
# `readlink /proc/self/ns/pid` (e.g. "pid:[4026531836]") is this process's
# own pid-namespace identity, and this must NEVER be empty: a system with
# no `/proc/self/ns/pid` at all (no Linux pid namespaces, e.g. macOS) falls
# back to the literal "none" — like an empty/missing label,
# should_reclaim_stale_project never trusts an empty one, but "none" is
# non-empty and self-consistent on a system where the concept doesn't
# apply at all (there is only one flat pid space there, so "none" == "none"
# is exactly as correct as pidns matching is everywhere else).
OWNER_PIDNS="$(readlink /proc/self/ns/pid 2>/dev/null)"
if [ -z "${OWNER_PIDNS}" ]; then
  OWNER_PIDNS="none"
fi
export LEGAJO_FULLSTACK_E2E_OWNER_PIDNS="${OWNER_PIDNS}"
COMPOSE_LABEL_FILE="${SCRIPT_DIR}/docker/fullstack-e2e-labels.override.yml"
# Every `docker compose` call for OUR OWN project goes through this array
# (both compose files together), so the ownership labels above are applied
# consistently everywhere — build, up, logs, and this run's own teardown.
COMPOSE=(docker compose -p "${COMPOSE_PROJECT}" -f "${COMPOSE_FILE}" -f "${COMPOSE_LABEL_FILE}")

# The frontend's host port DOES have a documented override
# (LEGAJO_FRONTEND_PORT, read by the backend Compose file itself); the
# backend's "8080:8080" mapping does not, and this repo never edits the
# backend's Compose file to add one. Reading the SAME variable here that the
# backend Compose file reads (rather than hardcoding 80) is what keeps the
# check honest: checking a port this run isn't actually about to bind would
# both miss a real conflict on the overridden port and report a false
# conflict on 80 when nothing here is going to touch 80 at all.
FRONTEND_PORT="${LEGAJO_FRONTEND_PORT:-80}"
BACKEND_PORT=8080

E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:${FRONTEND_PORT}}"
E2E_BACKEND_BASE_URL="${E2E_BACKEND_BASE_URL:-http://localhost:${BACKEND_PORT}}"

echo "==> full-stack e2e: backend compose at ${COMPOSE_FILE}"
echo "==> full-stack e2e: frontend built from ${LEGAJO_FRONTEND_DIR}"
echo "==> full-stack e2e: compose project ${COMPOSE_PROJECT}"

# A project from a run whose OWNER PROCESS is gone (SIGKILL, an OOM kill, a
# CI runner that got torn down mid-job) never reaches its own `cleanup`
# trap below, so its containers stay up and its ports stay bound forever —
# every later run's port check would then fail permanently, not just while
# a real concurrent run is in progress. `cleanup_stale_fullstack_projects`
# (sourced above from lib/fullstack-stale-reclaim.sh) reclaims only a
# project this script itself created (name prefix) AND can positively
# identify as dead — its own ownership label, from
# scripts/docker/fullstack-e2e-labels.override.yml, names a (host, pid
# namespace, PID) IDENTITY that no longer EXISTS on this host, in this pid
# namespace, judged by `kill -0`'s own error TEXT (see
# lib/fullstack-stale-reclaim.sh's own comment for why a bare exit code,
# or a `/proc/$pid` existence check, both get this wrong) rather than by
# whether this process may signal it. Anything else — unlabeled, on a
# different host, in a different pid namespace, or still alive (including
# a live process owned by a DIFFERENT user) — is left untouched. PID reuse
# by the OS is a known, accepted limitation of a liveness check like this
# one: it would take another
# process landing on the exact freed PID inside this narrow window, and
# the failure mode is the safe direction (treating a genuinely dead run as
# still alive, never the reverse).
echo "==> checking for stale full-stack e2e projects left by a killed run"
cleanup_stale_fullstack_projects

# The stack's host ports (FRONTEND_PORT for `frontend`, BACKEND_PORT for
# `backend`) are both checked the same way: BACKEND_PORT has no override to
# read (see its own comment above), so checking it unconditionally, exactly
# like FRONTEND_PORT, is the one option that treats both ports consistently
# instead of trusting one and guessing at the other.
port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

check_port_free() {
  local port="$1" label="$2"
  if port_in_use "${port}"; then
    echo "ERROR: host port ${port} (${label}) is already in use." >&2
    echo "  scripts/e2e-fullstack-in-docker.sh checks the exact host ports this" >&2
    echo "  run is about to bind (FRONTEND_PORT=${FRONTEND_PORT}," >&2
    echo "  BACKEND_PORT=${BACKEND_PORT}) so only one full-stack run can hold" >&2
    echo "  them at a time. Wait for the other run to finish, free the port, or" >&2
    echo "  set LEGAJO_FRONTEND_PORT to a free one (BACKEND_PORT has no override" >&2
    echo "  — see this script's own comments for why)." >&2
    exit 1
  fi
}

check_ports_free() {
  check_port_free "${FRONTEND_PORT}" "frontend, LEGAJO_FRONTEND_PORT in the backend Compose file"
  check_port_free "${BACKEND_PORT}" "backend, fixed in the backend Compose file"
}

echo "==> checking host ports ${FRONTEND_PORT} and ${BACKEND_PORT} are free before building the stack"
check_ports_free

# Runs on every exit path (normal, `set -e` abort, or a later `exit`), not
# just the success path: dumps compose logs only when something actually
# failed (a green run's logs are noise, not evidence), then always tears the
# stack down, then re-raises the ORIGINAL exit status explicitly — without
# that explicit `exit`, a later command inside this trap succeeding would
# silently replace it with 0, masking a real failure exactly like the
# `; docker compose down` one-liner this shape already replaced elsewhere in
# this project's containers work.
cleanup() {
  local status=$?
  if [ "${status}" -ne 0 ]; then
    echo "==> full-stack e2e failed (exit ${status}); dumping compose logs" >&2
    "${COMPOSE[@]}" logs --no-color || true
  fi
  echo "==> tearing down the Compose stack (project ${COMPOSE_PROJECT})"
  "${COMPOSE[@]}" down --remove-orphans || true
  exit "${status}"
}
trap cleanup EXIT

echo "==> docker compose build (project ${COMPOSE_PROJECT})"
"${COMPOSE[@]}" build

# Re-checked right BEFORE the containers actually bind a host port, not only
# once at the top of this script: the check above and the actual bind are
# necessarily two separate steps (this script cannot both let `docker
# compose` own the bind AND claim the port itself first), so a second run
# that passed the first check while this one was still building could still
# reach `up` at the same time. Checking again here, after the (usually much
# longer) build step and immediately before `up`, closes most of that
# window; it does not make the check atomic with the bind — a run that
# loses even this narrower race still fails, just with Docker's own "port is
# already allocated" error instead of this script's clearer one, and still
# only ever tears down its OWN Compose project (COMPOSE_PROJECT is unique
# per run, set above).
echo "==> re-checking host ports ${FRONTEND_PORT} and ${BACKEND_PORT} are still free before starting containers"
check_ports_free

echo "==> docker compose up --wait (project ${COMPOSE_PROJECT})"
"${COMPOSE[@]}" up -d --wait

# shellcheck source=lib/playwright-image.sh
source "${SCRIPT_DIR}/lib/playwright-image.sh"
PLAYWRIGHT_VERSION="$(resolve_playwright_version "${REPO_DIR}")"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"

# A DEDICATED volume, not scripts/e2e-in-docker.sh's
# "legajo-frontend-node-modules-noble" one: CI runs the mocked `ci` job and
# this script's own `fullstack-e2e` job in parallel (no `needs:` between
# them, .github/workflows/frontend.yml), and `npm ci` writing into the same
# named volume from two containers at once is a real race — concurrent
# installs into one node_modules tree can interleave partial writes and
# corrupt it non-deterministically. A second, separate volume costs one more
# full `npm ci` the first time either runner is used, which is cheap next to
# a flaky, hard-to-reproduce corrupted-install failure.
#
# This volume's NAME is fixed (unlike COMPOSE_PROJECT above), so two
# concurrent runs of THIS script still share it — the port check above
# already keeps two full stacks from ever running at once, but `npm ci`
# writing into this volume is a separate, narrower race than the ports one,
# so it gets its own, separate fix below.
VOLUME="legajo-frontend-node-modules-noble-fullstack"

# A SEPARATE, dedicated volume for the flock(1) lock file that serializes
# npm ci below — NOT a file inside VOLUME itself. `npm ci` removes
# node_modules' existing CONTENTS before reinstalling (that is the whole
# point of `ci` over `install`), which would delete a lock file living
# inside it out from under whichever run's fd still has it locked: a second
# run starting its own `exec 9>` against that now-missing path would just
# create a brand new file (a new inode) and lock THAT instead, acquiring
# instantly with no contention at all — while the first run's `npm ci` is
# still in progress. A lock has to live somewhere `npm ci` never touches to
# mean anything; this volume, mounted at its own path below, is that place.
LOCK_VOLUME="legajo-frontend-fullstack-e2e-npm-ci-lock"
LOCK_MOUNT="/legajo-lock"

# shellcheck source=lib/docker-volume.sh
source "${SCRIPT_DIR}/lib/docker-volume.sh"
prepare_host_owned_volume "${VOLUME}" "${IMAGE}"
prepare_host_owned_volume "${LOCK_VOLUME}" "${IMAGE}"

INNER_SCRIPT="$(cat <<'INNER'
set -e

# Serializes npm ci across concurrent containers sharing the node_modules
# volume: the lock file lives on ITS OWN volume (mounted at $LOCK_MOUNT,
# passed in via -e below), not inside node_modules — see the LOCK_VOLUME
# comment above for why that distinction is the whole fix. `flock -w` fails
# fast with a distinct exit code (75) on a timeout instead of hanging
# forever if a previous holder never released it.
LOCK_FILE="${LOCK_MOUNT}/npm-ci.lock"
exec 9>"${LOCK_FILE}"
# `flock` is the direct condition of this `if`, not negated with `!`: bash
# exempts a command tested that way from `set -e` (above), so a failed lock
# reaches the `else` branch instead of aborting the script before `$?` can
# be read there.
if flock -w 600 -E 75 9; then
  : # lock acquired, fall through to npm ci
else
  lock_status=$?
  if [ "${lock_status}" -eq 75 ]; then
    echo "ERROR: timed out after 600s waiting for another concurrent full-stack" >&2
    echo "  e2e run to finish npm ci on the shared node_modules volume." >&2
  fi
  exit "${lock_status}"
fi

if ! npm ci; then
  echo "ERROR: npm ci failed inside the Playwright full-stack e2e container" >&2
  exit 1
fi
# Release the lock as soon as the install itself is done — the test run
# after it doesn't write into node_modules, so it doesn't need to hold
# other runs back.
exec 9>&-

installed="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' node_modules/@playwright/test/package.json | head -n1)"
if [ "$installed" != "$PLAYWRIGHT_VERSION" ]; then
  echo "ERROR: installed @playwright/test ($installed) does not match the" >&2
  echo "  pinned Playwright image (v$PLAYWRIGHT_VERSION-noble); browsers and" >&2
  echo "  the test runner would be out of sync. Re-run" >&2
  echo "  scripts/e2e-fullstack-in-docker.sh after package-lock.json settles." >&2
  exit 1
fi

npm run e2e:fullstack
INNER
)"

echo "==> running the full-stack Playwright suite against ${E2E_BASE_URL}"
# `--network host` (not a port mapping): the browser inside this container
# needs to reach BOTH the frontend and the backend exactly as
# E2E_BASE_URL/E2E_BACKEND_BASE_URL name them (http://localhost[:8080]),
# which are the Compose stack's own published host ports (TRD §14.2) — the
# same reason scripts/smoke-image.sh and the backend's own smoke.sh run
# their curl/HTTP checks with `--network host` instead of a published port
# of their own. No `--ipc=host`: `--shm-size=1gb` below already gives
# Chromium the /dev/shm room it needs without sharing the host's IPC
# namespace (same choice scripts/e2e-in-docker.sh makes, for the same
# reason).
docker run --rm \
  --network host \
  --user "$(id -u):$(id -g)" \
  --shm-size=1gb \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm-cache \
  -e CI=true \
  -e PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION}" \
  -e E2E_BASE_URL="${E2E_BASE_URL}" \
  -e E2E_BACKEND_BASE_URL="${E2E_BACKEND_BASE_URL}" \
  -e LOCK_MOUNT="${LOCK_MOUNT}" \
  -v "${REPO_DIR}:/workspace" \
  -v "${VOLUME}:/workspace/node_modules" \
  -v "${LOCK_VOLUME}:${LOCK_MOUNT}" \
  -w /workspace \
  "${IMAGE}" \
  sh -c "${INNER_SCRIPT}"

echo "==> full-stack e2e passed"
