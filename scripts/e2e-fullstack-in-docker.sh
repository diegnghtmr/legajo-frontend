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
#                          (default: http://localhost, TRD §14.2 Compose
#                          `frontend` port).
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

COMPOSE_FILE="${BACKEND_DIR}/docker-compose.yml"
# An explicit, fixed Compose project name — never Compose's own default
# (derived from the compose file's directory name, e.g. "backend" for a
# checkout at .../backend). Without this, a developer's own, independently
# started `docker compose up` in that same backend checkout (same directory,
# same default project name) would be the SAME Compose project as this
# script's own stack: `docker compose down` below would then tear down
# whatever the developer left running, not just what this run started. A
# distinct project name keeps this run's containers/network in their own
# namespace, so teardown can only ever affect this run's own resources.
COMPOSE_PROJECT="legajo-frontend-fullstack-e2e"
# The backend Compose file's `frontend` service builds from
# `${LEGAJO_FRONTEND_DIR:-../frontend}` (task K4); pointing it at THIS
# checkout is what makes the full-stack stack test the frontend under
# review, not whatever `../frontend` happens to resolve to relative to the
# backend checkout.
export LEGAJO_FRONTEND_DIR="${REPO_DIR}"

E2E_BASE_URL="${E2E_BASE_URL:-http://localhost}"
E2E_BACKEND_BASE_URL="${E2E_BACKEND_BASE_URL:-http://localhost:8080}"

echo "==> full-stack e2e: backend compose at ${COMPOSE_FILE}"
echo "==> full-stack e2e: frontend built from ${LEGAJO_FRONTEND_DIR}"

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
    docker compose -p "${COMPOSE_PROJECT}" -f "${COMPOSE_FILE}" logs --no-color || true
  fi
  echo "==> tearing down the Compose stack (project ${COMPOSE_PROJECT})"
  docker compose -p "${COMPOSE_PROJECT}" -f "${COMPOSE_FILE}" down --remove-orphans || true
  exit "${status}"
}
trap cleanup EXIT

echo "==> docker compose up --build --wait (project ${COMPOSE_PROJECT})"
docker compose -p "${COMPOSE_PROJECT}" -f "${COMPOSE_FILE}" up -d --build --wait

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
VOLUME="legajo-frontend-node-modules-noble-fullstack"

# shellcheck source=lib/docker-volume.sh
source "${SCRIPT_DIR}/lib/docker-volume.sh"
prepare_host_owned_volume "${VOLUME}" "${IMAGE}"

INNER_SCRIPT="$(cat <<'INNER'
set -e

if ! npm ci; then
  echo "ERROR: npm ci failed inside the Playwright full-stack e2e container" >&2
  exit 1
fi

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
  -v "${REPO_DIR}:/workspace" \
  -v "${VOLUME}:/workspace/node_modules" \
  -w /workspace \
  "${IMAGE}" \
  sh -c "${INNER_SCRIPT}"

echo "==> full-stack e2e passed"
