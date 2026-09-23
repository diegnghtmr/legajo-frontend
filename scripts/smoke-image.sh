#!/bin/sh
# Image smoke test for the Legajo frontend container (TRD §14.2/§14.3,
# CI job `image-smoke`).
#
# Verifies, against a running container's published port:
#   1. GET /             -> 200, body contains the app mount node (id="root")
#   2. GET /<deep route> -> 200, same index.html body (SPA fallback works)
#   3. GET /             -> Cache-Control: no-cache (never cache the shell)
#   4. GET /assets/<hash> -> 200, long-lived immutable Cache-Control
#
# This script itself must run inside a container (TRD §14.2: nothing is
# verified on the host), e.g. with the pinned curl image and the repo
# bind-mounted read-only:
#
#   docker run --rm --network host \
#     -v "$(pwd)":/workspace:ro -w /workspace \
#     curlimages/curl:8.15.0 sh scripts/smoke-image.sh http://localhost:8081
#
# Usage: smoke-image.sh <base-url>
set -eu

BASE_URL="${1:?usage: smoke-image.sh <base-url>}"
# Strip a trailing slash so "$BASE_URL/path" never doubles up.
BASE_URL="${BASE_URL%/}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

fail() {
  echo "SMOKE FAIL: $1" >&2
  exit 1
}

pass() {
  echo "SMOKE OK: $1"
}

# fetch <url> <header-file> <body-file> -> prints the HTTP status code
fetch() {
  curl -sS -D "$2" -o "$3" -w '%{http_code}' "$1"
}

header_value() {
  # header_value <header-file> <name> -> the header's value, trimmed
  grep -i "^$2:" "$1" | tr -d '\r' | cut -d':' -f2- | sed 's/^ *//'
}

# --- 1. Root document -------------------------------------------------
root_headers="$WORKDIR/root.headers"
root_body="$WORKDIR/root.body"
status="$(fetch "$BASE_URL/" "$root_headers" "$root_body")"
[ "$status" = "200" ] || fail "GET / returned $status, expected 200"
grep -q 'id="root"' "$root_body" || fail 'GET / body does not contain the app root element (id="root")'
pass "GET / -> 200 with app root element"

# --- 2. Deep SPA route falls back to the same index.html --------------
DEEP_ROUTE="/clustering"
deep_headers="$WORKDIR/deep.headers"
deep_body="$WORKDIR/deep.body"
status="$(fetch "$BASE_URL$DEEP_ROUTE" "$deep_headers" "$deep_body")"
[ "$status" = "200" ] || fail "GET $DEEP_ROUTE returned $status, expected 200 (SPA fallback)"
cmp -s "$root_body" "$deep_body" || fail "GET $DEEP_ROUTE body differs from GET / body: SPA fallback is not serving index.html"
pass "GET $DEEP_ROUTE -> 200, same index.html as / (SPA fallback)"

# --- 3. index.html is never cached across deploys ----------------------
cache_control="$(header_value "$root_headers" 'cache-control')"
case "$cache_control" in
  *no-cache*) pass "GET / Cache-Control: $cache_control" ;;
  *) fail "GET / Cache-Control is '$cache_control', expected it to contain no-cache" ;;
esac

# --- 4. A hashed asset referenced by index.html is long-cached ---------
asset_path="$(grep -oE '/assets/[A-Za-z0-9._-]+\.(js|css)' "$root_body" | head -n1 || true)"
[ -n "$asset_path" ] || fail "no /assets/*.js or /assets/*.css reference found in the index.html body"
asset_headers="$WORKDIR/asset.headers"
asset_body="$WORKDIR/asset.body"
status="$(fetch "$BASE_URL$asset_path" "$asset_headers" "$asset_body")"
[ "$status" = "200" ] || fail "GET $asset_path returned $status, expected 200"
asset_cache="$(header_value "$asset_headers" 'cache-control')"
case "$asset_cache" in
  *max-age=31536000*) pass "GET $asset_path -> 200, Cache-Control: $asset_cache" ;;
  *) fail "GET $asset_path Cache-Control is '$asset_cache', expected a long max-age (immutable hashed asset)" ;;
esac

echo "SMOKE PASS: all image smoke checks passed for $BASE_URL"
