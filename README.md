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

- Node 24 LTS. This repo pins it via `.nvmrc` and `package.json#engines`. If
  your machine's default Node is different, run commands through
  [`mise`](https://mise.jdx.dev): `mise exec node@24 -- npm <script>`.

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

- `VITE_API_BASE_URL` — base URL of the backend API, set at build time. Empty
  in development (the Vite proxy handles `/api`); set to the deployed Render
  URL for a production build. Document it in `.env.example` (this task did not
  create that file — see the W1 progress notes for why); never commit a real
  value.

## Deployment

Static Vercel deployment of the Vite build; `vercel.json` rewrites every route
to `/index.html` (SPA fallback). See TRD §14.4 for the Render/Vercel pairing
and CORS origins.
