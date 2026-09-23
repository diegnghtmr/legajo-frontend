#!/usr/bin/env bash
# Runs the mocked Playwright + axe suite (`npm run e2e`) inside the official
# Playwright image, using ITS bundled Chromium and Node — never a host
# browser or a temporary config pointing at one (TRD §14.2: nothing is
# verified on the host).
#
# The image tag is derived from package-lock.json's resolved
# `@playwright/test` version (scripts/lib/playwright-image.sh, shared with
# scripts/e2e-fullstack-in-docker.sh), not hand-maintained: a hardcoded tag
# can drift from the lockfile whenever a dependency bump changes it, silently
# pairing mismatched browsers and test runner. After `npm ci` runs inside the
# container, the installed `@playwright/test` version is checked against
# that same tag as a second guard, in case the lockfile itself is stale
# against node_modules.
#
# Uses its own node_modules volume, separate from scripts/npm-in-docker.sh's
# node:24-alpine volume: this Playwright image is glibc/Ubuntu (noble) while
# the other is musl/Alpine, and this repo's dependencies (esbuild, Rollup,
# @tailwindcss/oxide, lightningcss) ship libc-specific native binaries that
# cannot be shared across the two.
#
# `npm run e2e` is `VITE_API_BASE_URL=http://localhost:4173 npm run build &&
# playwright test`; playwright.config.ts's webServer runs
# `vite preview --port 4173` for it, and its bundled browsers are picked up
# automatically via the image's PLAYWRIGHT_BROWSERS_PATH — no extra install
# step, no override.
#
# Usage: scripts/e2e-in-docker.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VOLUME="legajo-frontend-node-modules-noble"

# shellcheck source=lib/playwright-image.sh
source "${SCRIPT_DIR}/lib/playwright-image.sh"
PLAYWRIGHT_VERSION="$(resolve_playwright_image "${REPO_DIR}")"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"

# shellcheck source=lib/docker-volume.sh
source "${SCRIPT_DIR}/lib/docker-volume.sh"
prepare_host_owned_volume "${VOLUME}" "${IMAGE}"

# Runs inside the container: `set -e` so a failed `npm ci` stops the script
# right there (with its own clear message) instead of falling through to
# `npm run e2e` against a half-installed node_modules; then a second guard
# compares the just-installed @playwright/test version against the image
# tag chosen above, in case node_modules/package-lock.json disagree.
# Built with a quoted heredoc (`<<'INNER'`, not string interpolation): every
# `$...` reference here (`$installed`, `$PLAYWRIGHT_VERSION`, the `if`
# comparison) must stay literal text while this OUTER script builds the
# INNER_SCRIPT string, and only get expanded once by the CONTAINER's own
# shell when it actually runs — an unquoted heredoc would let this outer
# script's shell expand them (against variables that don't exist here) while
# building the string, breaking the script long before the container ever
# sees it. `$PLAYWRIGHT_VERSION` itself reaches the container as its own
# `-e PLAYWRIGHT_VERSION=...` environment variable below, not by
# interpolating its value into this string at all.
INNER_SCRIPT="$(cat <<'INNER'
set -e

if ! npm ci; then
  echo "ERROR: npm ci failed inside the Playwright e2e container" >&2
  exit 1
fi

installed="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' node_modules/@playwright/test/package.json | head -n1)"
if [ "$installed" != "$PLAYWRIGHT_VERSION" ]; then
  echo "ERROR: installed @playwright/test ($installed) does not match the" >&2
  echo "  pinned Playwright image (v$PLAYWRIGHT_VERSION-noble); browsers and" >&2
  echo "  the test runner would be out of sync. Re-run scripts/e2e-in-docker.sh" >&2
  echo "  after package-lock.json settles." >&2
  exit 1
fi

npm run e2e
INNER
)"

# `--shm-size=1gb`: Chromium needs more than Docker's default 64MB
# /dev/shm, or it can crash rendering larger pages. This grows the
# CONTAINER's own /dev/shm instead; unlike `--ipc=host` (Playwright's other
# documented option), it does not share the host's IPC namespace.
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --shm-size=1gb \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm-cache \
  -e CI=true \
  -e PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION}" \
  -v "${REPO_DIR}:/workspace" \
  -v "${VOLUME}:/workspace/node_modules" \
  -w /workspace \
  "${IMAGE}" \
  sh -c "${INNER_SCRIPT}"
