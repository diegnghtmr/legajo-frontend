#!/usr/local/bin/bash
# Entry point for the cleanup_stale_fullstack_projects integration case:
# starts a real process, kills and reaps it (a genuinely dead owner),
# then runs cleanup_stale_fullstack_projects with `docker` stubbed (see
# ./docker in this same directory, prepended onto PATH below) so it never
# touches a real daemon. Invoked by
# scripts/tests/fullstack-stale-reclaim.test.sh via
# `docker run ... bash:5.2 /support/integration-case.sh`.
set -euo pipefail
export PATH="/support:${PATH}"

# shellcheck source=../../../lib/fullstack-stale-reclaim.sh
. /workspace/scripts/lib/fullstack-stale-reclaim.sh

sleep 100 &
DEAD_PID=$!
kill "${DEAD_PID}"
wait "${DEAD_PID}" 2>/dev/null || true
export DEAD_PID

COMPOSE_PROJECT="legajo-frontend-fullstack-e2e-current"
COMPOSE_FILE="/dummy/docker-compose.yml"
COMPOSE_LABEL_FILE="/dummy/labels.yml"
LEGAJO_FULLSTACK_E2E_OWNER_HOST="test-host"
LEGAJO_FULLSTACK_E2E_OWNER_PIDNS="test-pidns"

cleanup_stale_fullstack_projects
