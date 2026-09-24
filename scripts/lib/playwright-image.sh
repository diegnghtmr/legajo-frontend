#!/usr/bin/env bash
# Shared helper for scripts/e2e-in-docker.sh and
# scripts/e2e-fullstack-in-docker.sh: resolves the exact `@playwright/test`
# version pinned in package-lock.json, so the mcr.microsoft.com/playwright
# image tag each script builds from it can never drift from a hand-
# maintained comment. Both scripts need the identical version string — one
# to pick its mocked-suite browser image, the other its full-stack-suite
# browser image — so this lives in one place instead of two copies that
# could quietly diverge.
#
# Parsed with `node -e ... JSON.parse(...)` run inside a throwaway
# container — not a host tool, and not a grep/sed regex against the
# lockfile's text — for two reasons: a real JSON parser cannot misread the
# file the way a regex can (e.g. matching an unrelated "version" key), and
# the container's own `console.error` + `process.exit(1)` prints its
# failure message directly at the point of failure. A bash-level guard
# placed *after* a failing pipeline is fragile here: under
# `set -euo pipefail`, a `grep` that matches nothing exits the whole caller
# script right there, before any later `if` ever runs.
#
# Usage: resolve_playwright_version <repo-dir>
# Prints the resolved VERSION ONLY (e.g. "1.63.0") to stdout, never a full
# image reference — named resolve_playwright_version, not
# resolve_playwright_image, precisely because of that: the caller still has
# to build its own "mcr.microsoft.com/playwright:v<version>-noble" tag from
# the returned string.

resolve_playwright_version() {
  local repo_dir="$1"
  local lockfile_image="node:24-alpine" # tiny, already used by scripts/npm-in-docker.sh

  docker run --rm -v "${repo_dir}/package-lock.json:/package-lock.json:ro" "${lockfile_image}" \
    node -e '
      const fs = require("fs");
      const lock = JSON.parse(fs.readFileSync("/package-lock.json", "utf8"));
      const entry = lock.packages && lock.packages["node_modules/@playwright/test"];
      const version = entry && entry.version;
      if (typeof version !== "string" || version === "") {
        console.error(
          "ERROR: package-lock.json has no resolved version for " +
          "\"node_modules/@playwright/test\" under .packages. " +
          "scripts/lib/playwright-image.sh needs this to pick a matching " +
          "mcr.microsoft.com/playwright image tag."
        );
        process.exit(1);
      }
      process.stdout.write(version);
    '
}
