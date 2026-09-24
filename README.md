# Legajo — frontend

Single-page app for Legajo: corpus selection, six-capability similarity
comparison with traces, matrix view, four-linkage hierarchical clustering with
metrics and cut, embeddings status, bilingual ES/EN, WCAG 2.1 AA. Consumes the
backend's OpenAPI contract; never computes similarity, linkages, cuts or
metrics itself.

Product and visual rules live outside this repository, in the private
workspace `docs/` (PRD, TRD, `DESIGN.md`) and in `AGENTS.md`. This README only
covers what an engineer needs to run and build the app.

## Stack

React 19.2, Vite 8, TypeScript 5.9 (strict), Tailwind CSS 4 (CSS-first
`@theme`, no `tailwind.config`), Vitest 4 + Testing Library, Playwright with
axe, `openapi-typescript` for generated API types. See `frontend/AGENTS.md`
for the full pile and folder map.

## Requirements

- Docker (29+) and Docker Compose. Every check, build and test in this repo
  runs inside a container — see "Checks run in containers" below — so a host
  install of Node is not required to work on this app.
- Node 24 LTS is still pinned via `.nvmrc` and `package.json#engines` for
  editor tooling (IntelliSense, `tsc` in your IDE); it is never required to
  run a check.

## Running with Docker

Build the production image (`Dockerfile`, multi-stage: Node 24 build →
`nginx-unprivileged` runtime). `VITE_API_BASE_URL` is a **required build-time**
value — Vite inlines it into the bundle, so it cannot change after the image
is built. There is no default: the build fails with a clear error if
`--build-arg VITE_API_BASE_URL` is missing, empty, or has any whitespace
inside the value (surrounding whitespace is trimmed; interior whitespace is
rejected outright, never silently stripped — a typo like `http://local
host:8080` must fail, not quietly become `http://localhost:8080`), rather
than silently shipping a bundle pointing at the wrong API. Every caller
passes it explicitly — this command, the `image-smoke` CI job, and the
backend repository's Compose `frontend` service (task K4), which defaults
this same argument to `http://localhost:8080`:

```sh
docker build --build-arg VITE_API_BASE_URL=http://localhost:8080 \
  -t legajo-frontend:local .
```

Run it. The container listens on `:8080` (it runs as a non-root user, so it
cannot bind `:80` itself); publish it on host `:80` per TRD §14.2:

```sh
docker run --rm -p 80:8080 legajo-frontend:local
```

The image ships a `HEALTHCHECK` that polls `/`; `docker ps` shows
`healthy`/`unhealthy` once it settles.

## Checks run in containers

Nothing in this repo is verified on the host — every check below runs inside
a container (TRD §14.2). `scripts/npm-in-docker.sh` runs an `npm` command
against the pinned `node:24-alpine` image, with the repo bind-mounted and
`node_modules` kept in its own named Docker volume (so the container and any
host-installed `node_modules` never collide). `scripts/e2e-in-docker.sh` uses
its own pinned Playwright image and its own `node_modules` volume, for a
different reason: that image is glibc/Ubuntu while `node:24-alpine` is
musl/Alpine, and this repo's native dependencies can't share binaries across
the two (see the comment at the top of that script). `scripts/smoke-image.sh`
is unrelated to either volume — it has no Node/`node_modules` of its own at
all, only a `curl`-based check that runs in a separate, minimal pinned image
(see the comment at the top of that script for why).

| Check                                         | Container command                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Install dependencies                          | `scripts/npm-in-docker.sh ci`                                                                |
| Format check                                  | `scripts/npm-in-docker.sh run format:check`                                                  |
| Lint                                          | `scripts/npm-in-docker.sh run lint`                                                          |
| Typecheck                                     | `scripts/npm-in-docker.sh run typecheck`                                                     |
| Design token conformance                      | `scripts/npm-in-docker.sh run check:tokens`                                                  |
| Unit/contract tests with coverage             | `scripts/npm-in-docker.sh run test:coverage`                                                 |
| Production build                              | `scripts/npm-in-docker.sh run build`                                                         |
| API types drift (after `npm run api:types`)   | `scripts/npm-in-docker.sh run api:types` then `git diff --exit-code src/shared/types/api.ts` |
| Mocked end-to-end (Playwright + axe)          | `scripts/e2e-in-docker.sh`                                                                   |
| Full-stack end-to-end, no mocks (see below)   | `scripts/e2e-fullstack-in-docker.sh`                                                         |
| Image smoke test                              | needs a running container — see "Image smoke test" below                                     |
| `docker-volume.sh` volume-ownership helper    | `scripts/tests/docker-volume.test.sh`                                                        |
| `VITE_API_BASE_URL` trim/validate guard       | `scripts/tests/api-base-url-guard.test.sh`                                                   |
| Stale full-stack e2e project reclaim decision | `scripts/tests/fullstack-stale-reclaim.test.sh`                                              |

### Image smoke test

Needs a container already running (see "Running with Docker" above):

```sh
docker run --rm --network host \
  -v "$(pwd)":/workspace:ro -w /workspace \
  curlimages/curl:8.15.0 sh scripts/smoke-image.sh <base-url>
```

It can run right away, with no separate wait step: it has its own bounded
readiness wait — a real wall-clock deadline (up to 30s total, each probe's
own timeout capped by whatever is left of that budget) — plus a
connect/total timeout on every ordinary request, so a not-yet-ready or hung
container fails it clearly instead of hanging forever. It then checks the
root document, all three security headers nginx.conf sets
(`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY`) plus a `Server`
header with no version number (`server_tokens off`), that a deep SPA route
(e.g. `/clustering`) falls back to the same `index.html` with the same
`Cache-Control: no-cache`, and the cache headers on the hashed
`/assets/*` output (cached for a year) — every check fails loudly on an
empty or missing value rather than treating it as a pass.

## Full-stack e2e (no mocks)

`npm run e2e` / `scripts/e2e-in-docker.sh` (above) mock every API response
with `page.route`. A separate suite, `e2e-fullstack/`, runs the same Flow
A/Flow B journeys (TAC-15) against a **real, already-running backend** —
zero interception anywhere (a static guard spec,
`e2e-fullstack/no-mocks.guard.spec.ts`, fails the suite if one is ever
added) — with the real, versioned 20-document corpus (ids `d01..d20`) and
real numbers cross-checked against the backend directly (e.g.
needleman-wunsch(d01, d02) ≈ 0.0707, the same value the backend's own
`scripts/smoke.sh` asserts).

It has its own Playwright config (`playwright.fullstack.config.ts`, no
`webServer`) and its own npm script:

```sh
scripts/e2e-fullstack-in-docker.sh
```

This brings up the full stack from the sibling backend repository's
`docker-compose.yml` (task K4: `backend` + `frontend`, the latter built from
THIS checkout), runs `npm run e2e:fullstack` inside the same pinned
Playwright image `scripts/e2e-in-docker.sh` uses, always tears the stack
down afterwards, and dumps Compose logs on failure. It looks for the backend
checkout at `../backend` by default; override with `LEGAJO_BACKEND_DIR` if
your sibling checkout lives elsewhere (in CI it is `legajo-backend/`, see
`.github/workflows/frontend.yml`'s `fullstack-e2e` job).

## Scripts

| Script                            | What it does                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server; proxies `/api` to `http://localhost:8080`                                                                 |
| `npm run build`                   | Type-checks (`tsc -b`) then builds the production bundle                                                                   |
| `npm run preview`                 | Serves the production build locally                                                                                        |
| `npm run typecheck`               | `tsc -b` across the app and tooling projects                                                                               |
| `npm run lint`                    | ESLint (flat config)                                                                                                       |
| `npm run format` / `format:check` | Prettier, write or check                                                                                                   |
| `npm run test`                    | Vitest unit/component/contract-type tests                                                                                  |
| `npm run test:coverage`           | Vitest with V8 coverage report                                                                                             |
| `npm run e2e`                     | Builds, then runs Playwright + axe against the preview server                                                              |
| `npm run e2e:fullstack`           | Runs the no-mocks Playwright + axe suite (`e2e-fullstack/`) against an already-running full-stack Compose stack            |
| `npm run check:tokens`            | Fails if a hex color literal appears in `src/` outside the `@theme` block of `src/index.css` (generated `api.ts` excluded) |
| `npm run api:sync`                | Copies `../backend/docs/openapi-legajo.yaml` into `contract/openapi-legajo.yaml` (workspace layout only)                   |
| `npm run api:types`               | Regenerates `src/shared/types/api.ts` from `contract/openapi-legajo.yaml`                                                  |

## Contract workflow

The backend owns `docs/openapi-legajo.yaml`; this repo never edits it. A
vendored copy lives at `contract/openapi-legajo.yaml` so CI can generate types
without reaching into the private, sibling `backend/` repo:

1. In the workspace layout (`legajo-general/{backend,frontend}`), run
   `npm run api:sync` to refresh `contract/openapi-legajo.yaml` from the
   backend after a contract change.
2. Run `npm run api:types` to regenerate `src/shared/types/api.ts`. Commit the
   regenerated file — it is generated but versioned, and CI fails on
   `git diff --exit-code src/shared/types/api.ts` after regenerating (contract
   drift check, TAC-12).
3. Never hand-edit `src/shared/types/api.ts`.

## Environment

- `VITE_API_BASE_URL` — base URL of the backend API, set at **build time**
  (Vite inlines it into the bundle; it cannot be changed at runtime). Empty in
  development (the Vite proxy handles `/api`); required and validated as an
  absolute URL for a production build (`src/infrastructure/env.ts`) — set to
  the deployed Render URL for Vercel, or passed as `--build-arg
VITE_API_BASE_URL=...` for the Docker image, where a missing or empty value
  fails the build immediately with a clear error (no silent default: see
  "Running with Docker"). `.env.example` documents this variable for local
  `npm run dev`/`npm run build` use; never commit a real value.

## Deployment

Static Vercel deployment of the Vite build; `vercel.json` rewrites every route
to `/index.html` (SPA fallback). The `nginx.conf`/`try_files` fallback in this
repo's Docker image is the equivalent for the local Compose stack and any
other container-based host. See TRD §14.4 for the Render/Vercel pairing and
CORS origins.

**Public URLs (TAC-11, pending deploy):**

- Frontend (Vercel): _pending — not deployed yet_
- Backend API base (Render): _pending — not deployed yet_

**Cold start.** The backend runs on Render's free tier, which suspends the
service when idle; the first request after a period of inactivity can take
tens of seconds while the instance wakes up. Before a live demo, poll
`GET <backend URL>/actuator/health` until it returns 200 so the instance is
already warm when the audience watches (TRD §14.4 point 4).
