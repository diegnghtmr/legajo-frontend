#!/bin/sh
# Image smoke test for the Legajo frontend container (TRD §14.2/§14.3,
# CI job `image-smoke`).
#
# Verifies, against a running container's published port:
#   0. Waits (bounded) for the container to start responding at all, so a
#      caller (e.g. CI, right after `docker run`) never needs its own sleep.
#   1. GET /             -> 200, body contains the app mount node (id="root")
#   2. GET /<deep route> -> 200, same index.html body (SPA fallback works)
#   3. GET /             -> Cache-Control: no-cache (never cache the shell)
#   4. GET /assets/<hash> -> 200, long-lived immutable Cache-Control
#
# Every request has its own connect/total timeout, so a hung or
# never-responding container fails this script instead of hanging it
# forever; every assertion fails loudly on an empty or missing value
# instead of silently treating it as passing.
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

CONNECT_TIMEOUT=2 # seconds to establish the TCP connection
MAX_TIME=10        # seconds for the whole request (headers + body)
READY_TIMEOUT=30   # seconds to wait for the container to start responding
READY_INTERVAL=1   # seconds between readiness probes

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

fail() {
  echo "SMOKE FAIL: $1" >&2
  exit 1
}

pass() {
  echo "SMOKE OK: $1"
}

# fetch <url> <header-file> <body-file> -> prints the HTTP status code, or
# "000" if the request could not be completed at all (refused/timed
# out/DNS failure), instead of aborting the script on curl's own exit code.
# Every caller below already fails on a non-"200" status, so "000" fails
# loudly with a clear message rather than crashing the script outright.
fetch() {
  curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
    -D "$2" -o "$3" -w '%{http_code}' "$1" 2>"$WORKDIR/curl-stderr.log" || true
}

header_value() {
  # header_value <header-file> <name> -> the header's value, trimmed
  grep -i "^$2:" "$1" | tr -d '\r' | cut -d':' -f2- | sed 's/^ *//'
}

# assert_header_contains <header-file> <header-name> <substring> <context>
# A missing header fails exactly like a present-but-wrong one: an empty
# value never matches a non-empty substring pattern, so there is no way for
# this to pass on nothing.
assert_header_contains() {
  value="$(header_value "$1" "$2")"
  case "$value" in
    *"$3"*) pass "$4 $2: $value" ;;
    *) fail "$4 $2 is '$value', expected it to contain '$3'" ;;
  esac
}

# --- 0. Bounded readiness wait -----------------------------------------
# The only wait in this script, and it is capped: a caller can run this
# immediately after `docker run` with no `sleep` of its own.
ready_status="000"
elapsed=0
while [ "$elapsed" -lt "$READY_TIMEOUT" ]; do
  ready_status="$(fetch "$BASE_URL/" "$WORKDIR/ready.headers" "$WORKDIR/ready.body")"
  if [ "$ready_status" = "200" ]; then
    break
  fi
  sleep "$READY_INTERVAL"
  elapsed=$((elapsed + READY_INTERVAL))
done
if [ "$ready_status" != "200" ]; then
  fail "container at $BASE_URL did not respond with 200 within ${READY_TIMEOUT}s (last status: $ready_status; curl: $(tail -n1 "$WORKDIR/curl-stderr.log" 2>/dev/null || echo n/a))"
fi

# --- 1. Root document -------------------------------------------------
root_headers="$WORKDIR/root.headers"
root_body="$WORKDIR/root.body"
status="$(fetch "$BASE_URL/" "$root_headers" "$root_body")"
[ "$status" = "200" ] || fail "GET / returned $status, expected 200"
[ -s "$root_body" ] || fail "GET / returned an empty body"
grep -q 'id="root"' "$root_body" || fail 'GET / body does not contain the app root element (id="root")'
pass "GET / -> 200 with app root element"

# --- 2. Deep SPA route falls back to the same index.html --------------
DEEP_ROUTE="/clustering"
deep_headers="$WORKDIR/deep.headers"
deep_body="$WORKDIR/deep.body"
status="$(fetch "$BASE_URL$DEEP_ROUTE" "$deep_headers" "$deep_body")"
[ "$status" = "200" ] || fail "GET $DEEP_ROUTE returned $status, expected 200 (SPA fallback)"
[ -s "$deep_body" ] || fail "GET $DEEP_ROUTE returned an empty body"
cmp -s "$root_body" "$deep_body" || fail "GET $DEEP_ROUTE body differs from GET / body: SPA fallback is not serving index.html"
pass "GET $DEEP_ROUTE -> 200, same index.html as / (SPA fallback)"

# --- 3. index.html is never cached across deploys ----------------------
assert_header_contains "$root_headers" 'cache-control' 'no-cache' "GET /"

# --- 4. A hashed asset referenced by index.html is long-cached ---------
asset_path="$(grep -oE '/assets/[A-Za-z0-9._-]+\.(js|css)' "$root_body" | head -n1)"
[ -n "$asset_path" ] || fail "no /assets/*.js or /assets/*.css reference found in the index.html body"
asset_headers="$WORKDIR/asset.headers"
asset_body="$WORKDIR/asset.body"
status="$(fetch "$BASE_URL$asset_path" "$asset_headers" "$asset_body")"
[ "$status" = "200" ] || fail "GET $asset_path returned $status, expected 200"
[ -s "$asset_body" ] || fail "GET $asset_path returned an empty body"
assert_header_contains "$asset_headers" 'cache-control' 'max-age=31536000' "GET $asset_path"

echo "SMOKE PASS: all image smoke checks passed for $BASE_URL"
