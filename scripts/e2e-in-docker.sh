#!/usr/bin/env bash
# Runs the mocked Playwright + axe suite (`npm run e2e`) inside the official
# Playwright image, using ITS bundled Chromium and Node — never a host
# browser or a temporary config pointing at one (TRD §14.2: nothing is
# verified on the host).
#
# The image tag is derived from package-lock.json's resolved
# `@playwright/test` version, not hand-maintained: a hardcoded tag can drift
# from the lockfile whenever a dependency bump changes it, silently pairing
# mismatched browsers and test runner. After `npm ci` runs inside the
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
LOCKFILE_IMAGE="node:24-alpine" # tiny, already used by scripts/npm-in-docker.sh

# The lockfile is the single source of truth for the pinned browser/runner
# version (see the comment above). Parsed with `node -e ... JSON.parse(...)`
# run inside a throwaway container — not a host tool, and not a grep/sed
# regex against the lockfile's text — for two reasons: a real JSON parser
# cannot misread the file the way a regex can (e.g. matching an unrelated
# "version" key), and the container's own `console.error` + `process.exit(1)`
# prints its failure message directly at the point of failure. A bash-level
# guard placed *after* a failing pipeline is fragile here: under
# `set -euo pipefail`, a `grep` that matches nothing exits the whole script
# right there, before any later `if` ever runs.
PLAYWRIGHT_VERSION="$(
  docker run --rm -v "${REPO_DIR}/package-lock.json:/package-lock.json:ro" "${LOCKFILE_IMAGE}" \
    node -e '
      const fs = require("fs");
      const lock = JSON.parse(fs.readFileSync("/package-lock.json", "utf8"));
      const entry = lock.packages && lock.packages["node_modules/@playwright/test"];
      const version = entry && entry.version;
      if (typeof version !== "string" || version === "") {
        console.error(
          "ERROR: package-lock.json has no resolved version for " +
          "\"node_modules/@playwright/test\" under .packages. " +
          "scripts/e2e-in-docker.sh needs this to pick a matching " +
          "mcr.microsoft.com/playwright image tag."
        );
        process.exit(1);
      }
      process.stdout.write(version);
    '
)"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"

# shellcheck source=lib/docker-volume.sh
source "${SCRIPT_DIR}/lib/docker-volume.sh"
prepare_host_owned_volume "${VOLUME}" "${IMAGE}"

# Runs inside the container: `set -e` so a failed `npm ci` stops the script
# right there (with its own clear message) instead of falling through to
# `npm run e2e` against a half-installed node_modules; then a second guard
# compares the just-installed @playwright/test version against the image
# tag chosen above, in case node_modules/package-lock.json disagree.
# Built with a quoted heredoc (not string interpolation) so `$installed` and
# `$PLAYWRIGHT_VERSION` are expanded by the container's shell, not by this
# script, and no nested-quoting is needed for the embedded JSON parsing.
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
