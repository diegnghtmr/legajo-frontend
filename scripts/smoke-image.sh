#!/bin/sh
# Image smoke test for the Legajo frontend container (TRD §14.2/§14.3,
# CI job `image-smoke`).
#
# Verifies, against a running container's published port:
#   0. Waits (bounded, wall-clock) for the container to start responding at
#      all, so a caller (e.g. CI, right after `docker run`) never needs its
#      own sleep.
#   1. GET /             -> 200, body contains the app mount node (id="root"),
#      all three baseline security headers nginx.conf sets on every
#      location block (X-Content-Type-Options: nosniff, Referrer-Policy:
#      strict-origin-when-cross-origin, X-Frame-Options: DENY), and a
#      Server header with no version number (server_tokens off)
#   2. GET /<deep route> -> 200, same index.html body (SPA fallback works),
#      same Cache-Control: no-cache as the real index.html
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

CONNECT_TIMEOUT=2             # seconds to establish the TCP connection
MAX_TIME=10                   # seconds for one ordinary request (headers + body)
SMOKE_READY_TIMEOUT_SECONDS=30 # wall-clock deadline for the readiness wait
READY_INTERVAL=1              # seconds to sleep between readiness probes

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

fail() {
  echo "SMOKE FAIL: $1" >&2
  exit 1
}

pass() {
  echo "SMOKE OK: $1"
}

# fetch <url> <header-file> <body-file> [max-time] -> prints the HTTP status
# code, or "000" if the request could not be completed at all
# (refused/timed out/DNS failure), instead of aborting the script on curl's
# own exit code. Every caller below already fails on a non-"200" status, so
# "000" fails loudly with a clear message rather than crashing the script
# outright. [max-time] defaults to $MAX_TIME; the readiness wait below
# passes a smaller value so a single slow probe cannot outlive the
# wall-clock deadline it is bounded by.
fetch() {
  probe_max_time="${4:-$MAX_TIME}"
  curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$probe_max_time" \
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

# assert_server_header_has_no_version <header-file> <context>
# nginx.conf sets `server_tokens off`, so the `Server` response header must
# be the bare product name with no version suffix (e.g. "nginx", never
# "nginx/1.27.4") — a version number in that header would mean
# `server_tokens off` regressed or a different, unconfigured server answered
# the request. Checked by the presence of any digit, not an exact-string
# match against "nginx": robust to nginx renaming its own default value
# without this check needing to track that string too.
assert_server_header_has_no_version() {
  value="$(header_value "$1" 'server')"
  case "$value" in
    '') fail "$2 Server header is missing" ;;
    *[0-9]*) fail "$2 Server is '$value', expected no version number (server_tokens off)" ;;
    *) pass "$2 Server: $value" ;;
  esac
}

# --- 0. Bounded readiness wait, measured wall-clock ---------------------
# A real deadline (`date +%s`), not an attempt counter: each probe's own
# --max-time is capped by whatever is left of the budget, so a run of
# slow/failed probes cannot stretch this past SMOKE_READY_TIMEOUT_SECONDS
# the way (attempts * MAX_TIME) could. The only wait in this script; a
# caller can run it immediately after `docker run` with no sleep of its own.
ready_deadline=$(($(date +%s) + SMOKE_READY_TIMEOUT_SECONDS))
ready_status="000"
while true; do
  remaining=$((ready_deadline - $(date +%s)))
  if [ "$remaining" -le 0 ]; then
    break
  fi
  probe_timeout="$MAX_TIME"
  if [ "$remaining" -lt "$MAX_TIME" ]; then
    probe_timeout="$remaining"
  fi
  ready_status="$(fetch "$BASE_URL/" "$WORKDIR/ready.headers" "$WORKDIR/ready.body" "$probe_timeout")"
  if [ "$ready_status" = "200" ]; then
    break
  fi
  sleep "$READY_INTERVAL"
done
if [ "$ready_status" != "200" ]; then
  fail "container at $BASE_URL did not respond with 200 within a ${SMOKE_READY_TIMEOUT_SECONDS}s wall-clock deadline (last status: $ready_status; curl: $(tail -n1 "$WORKDIR/curl-stderr.log" 2>/dev/null || echo n/a))"
fi

# --- 1. Root document -------------------------------------------------
root_headers="$WORKDIR/root.headers"
root_body="$WORKDIR/root.body"
status="$(fetch "$BASE_URL/" "$root_headers" "$root_body")"
[ "$status" = "200" ] || fail "GET / returned $status, expected 200"
[ -s "$root_body" ] || fail "GET / returned an empty body"
grep -q 'id="root"' "$root_body" || fail 'GET / body does not contain the app root element (id="root")'
pass "GET / -> 200 with app root element"
assert_header_contains "$root_headers" 'x-content-type-options' 'nosniff' "GET /"
assert_header_contains "$root_headers" 'referrer-policy' 'strict-origin-when-cross-origin' "GET /"
assert_header_contains "$root_headers" 'x-frame-options' 'DENY' "GET /"
assert_server_header_has_no_version "$root_headers" "GET /"

# --- 2. Deep SPA route falls back to the same index.html --------------
DEEP_ROUTE="/clustering"
deep_headers="$WORKDIR/deep.headers"
deep_body="$WORKDIR/deep.body"
status="$(fetch "$BASE_URL$DEEP_ROUTE" "$deep_headers" "$deep_body")"
[ "$status" = "200" ] || fail "GET $DEEP_ROUTE returned $status, expected 200 (SPA fallback)"
[ -s "$deep_body" ] || fail "GET $DEEP_ROUTE returned an empty body"
cmp -s "$root_body" "$deep_body" || fail "GET $DEEP_ROUTE body differs from GET / body: SPA fallback is not serving index.html"
pass "GET $DEEP_ROUTE -> 200, same index.html as / (SPA fallback)"
assert_header_contains "$deep_headers" 'cache-control' 'no-cache' "GET $DEEP_ROUTE"

# --- 3. index.html is never cached across deploys ----------------------
assert_header_contains "$root_headers" 'cache-control' 'no-cache' "GET /"

# --- 4. A hashed asset referenced by index.html is long-cached ---------
# `|| true` neutralizes the pipeline's exit status regardless of whether
# this shell has `pipefail` set: without it, a `grep` that matches nothing
# (exit 1) would abort the script right here under `set -e` + pipefail,
# before the explicit empty check below ever runs — a silent, unclear exit
# instead of the intended failure message.
asset_path="$(grep -oE '/assets/[A-Za-z0-9._-]+\.(js|css)' "$root_body" | head -n1 || true)"
[ -n "$asset_path" ] || fail "no /assets/*.js or /assets/*.css reference found in the index.html body"
asset_headers="$WORKDIR/asset.headers"
asset_body="$WORKDIR/asset.body"
status="$(fetch "$BASE_URL$asset_path" "$asset_headers" "$asset_body")"
[ "$status" = "200" ] || fail "GET $asset_path returned $status, expected 200"
[ -s "$asset_body" ] || fail "GET $asset_path returned an empty body"
assert_header_contains "$asset_headers" 'cache-control' 'max-age=31536000' "GET $asset_path"

echo "SMOKE PASS: all image smoke checks passed for $BASE_URL"
