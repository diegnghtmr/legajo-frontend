#!/usr/bin/env bash
# Runs the mocked Playwright + axe suite (`npm run e2e`) inside the official
# Playwright image, using ITS bundled Chromium and Node — never a host
# browser or a temporary config pointing at one (TRD §14.2: nothing is
# verified on the host). The image version below must match
# `@playwright/test`'s resolved version in package-lock.json exactly, so the
# test runner and the installed browsers stay in lockstep.
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
PLAYWRIGHT_VERSION="v1.63.0-noble" # keep in sync with @playwright/test (package-lock.json)
IMAGE="mcr.microsoft.com/playwright:${PLAYWRIGHT_VERSION}"
VOLUME="legajo-frontend-node-modules-noble"

docker volume create "${VOLUME}" >/dev/null

docker run --rm -v "${VOLUME}:/vol" "${IMAGE}" \
  chown -R "$(id -u):$(id -g)" /vol

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --ipc=host \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm-cache \
  -e CI=true \
  -v "${REPO_DIR}:/workspace" \
  -v "${VOLUME}:/workspace/node_modules" \
  -w /workspace \
  "${IMAGE}" \
  sh -c "npm ci && npm run e2e"
