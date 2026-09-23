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
`--build-arg VITE_API_BASE_URL` is missing or empty, rather than silently
shipping a bundle pointing at the wrong API. Every caller passes it
explicitly — this command, the `image-smoke` CI job, and the future Compose
`frontend` service:

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
host-installed `node_modules` never collide). `scripts/e2e-in-docker.sh` and
`scripts/smoke-image.sh` use their own pinned images for the same reason —
see the comments at the top of each script for why they cannot share that
volume or a base image with each other.

| Check                                       | Container command                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Install dependencies                        | `scripts/npm-in-docker.sh ci`                                                                |
| Format check                                | `scripts/npm-in-docker.sh run format:check`                                                  |
| Lint                                        | `scripts/npm-in-docker.sh run lint`                                                          |
| Typecheck                                   | `scripts/npm-in-docker.sh run typecheck`                                                     |
| Design token conformance                    | `scripts/npm-in-docker.sh run check:tokens`                                                  |
| Unit/contract tests with coverage           | `scripts/npm-in-docker.sh run test:coverage`                                                 |
| Production build                            | `scripts/npm-in-docker.sh run build`                                                         |
| API types drift (after `npm run api:types`) | `scripts/npm-in-docker.sh run api:types` then `git diff --exit-code src/shared/types/api.ts` |
| Mocked end-to-end (Playwright + axe)        | `scripts/e2e-in-docker.sh`                                                                   |
| Image smoke test                            | needs a running container — see "Image smoke test" below                                     |

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
root document and a baseline security header, that a deep SPA route (e.g.
`/clustering`) falls back to the same `index.html` with the same
`Cache-Control: no-cache`, and the cache headers on the hashed
`/assets/*` output (cached for a year) — every check fails loudly on an
empty or missing value rather than treating it as a pass.

A full-stack end-to-end suite against the real backend — no `page.route`
mocks — arrives in a follow-up task (F3); today's `npm run e2e` /
`scripts/e2e-in-docker.sh` suite mocks every API response.

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
