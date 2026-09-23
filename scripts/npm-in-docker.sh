#!/usr/bin/env bash
# Runs an `npm` command against the pinned Node 24 image so no check ever
# needs a host install of Node/npm (TRD §14.2: nothing is verified on the
# host). The repo is bind-mounted; node_modules lives in its own named
# Docker volume so the container never writes into — or fights over — a
# host-installed node_modules directory.
#
# This volume is musl/Alpine-specific: it must NOT be reused by
# scripts/e2e-in-docker.sh, which runs on the glibc/Ubuntu Playwright image.
# This repo's dependencies (esbuild, Rollup, @tailwindcss/oxide,
# lightningcss) ship libc-specific native binaries that only work with the
# libc they were installed under.
#
# Usage: scripts/npm-in-docker.sh <npm args...>
# Examples:
#   scripts/npm-in-docker.sh ci
#   scripts/npm-in-docker.sh run lint
#   scripts/npm-in-docker.sh run test:coverage
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
IMAGE="node:24-alpine"
VOLUME="legajo-frontend-node-modules-alpine"

docker volume create "${VOLUME}" >/dev/null

# The volume is root-owned the first time Docker creates it; align it with
# the host uid/gid up front so the actual command below (run unprivileged)
# can read and write it. A no-op chown on later runs is cheap.
docker run --rm -v "${VOLUME}:/vol" "${IMAGE}" \
  chown -R "$(id -u):$(id -g)" /vol

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm-cache \
  -v "${REPO_DIR}:/workspace" \
  -v "${VOLUME}:/workspace/node_modules" \
  -w /workspace \
  "${IMAGE}" \
  npm "$@"
