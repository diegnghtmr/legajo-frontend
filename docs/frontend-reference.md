# Legajo frontend reference

## Container workflow and script reference

Use Docker 29+ and Compose. The [pinned Node version](../.nvmrc) is for editor tooling on the host; local checks use containers. The npm wrapper binds the checkout and stores dependencies in a named Alpine/musl volume. The Playwright wrapper uses its own Ubuntu/glibc image and volume because the native dependencies are not interchangeable. Neither Node volume is used for the image smoke test.

| Command                                   | Purpose                                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/npm-in-docker.sh ci`             | Install the lockfile dependencies into the npm volume.                                                                                                                                              |
| `npm run dev`                             | Start Vite; the browser's `/api` requests are proxied to `http://localhost:8080` when the API base is empty.                                                                                        |
| `npm run build` / `npm run preview`       | Type-check and bundle for production, or serve the existing bundle.                                                                                                                                 |
| `npm run typecheck`                       | Run `tsc -b` across the app and tooling projects.                                                                                                                                                   |
| `npm run lint`                            | Run ESLint with the flat config.                                                                                                                                                                    |
| `npm run format` / `npm run format:check` | Apply or check Prettier formatting.                                                                                                                                                                 |
| `npm run check:tokens`                    | Reject hex colors in `src/` outside the `@theme` block in `src/index.css`, excluding generated API types.                                                                                           |
| `npm run test` / `npm run test:coverage`  | Run Vitest component, unit, and contract tests, optionally with V8 coverage.                                                                                                                        |
| `npm run e2e`                             | Build then run the mocked Playwright + axe suite against Vite preview. Use `scripts/e2e-in-docker.sh` locally.                                                                                      |
| `npm run e2e:fullstack`                   | Run the no-mock suite using [playwright.fullstack.config.ts](../playwright.fullstack.config.ts) against a running stack. Use `scripts/e2e-fullstack-in-docker.sh` to start and exercise it locally. |
| `npm run api:sync`                        | Copy the backend contract from `../backend/docs/openapi-legajo.yaml` in the paired workspace layout.                                                                                                |
| `npm run api:types`                       | Regenerate [the typed contract](../src/shared/types/api.ts) from the vendored YAML.                                                                                                                 |

These npm command names describe the scripts, not a separate host verification path. For commands such as lint and test, use `scripts/npm-in-docker.sh run <script>` after installing through the wrapper. After `api:types`, verify `git diff --exit-code src/shared/types/api.ts` if no contract change is intended. For an intended change, keep the copied contract and regenerated types together. The backend owns the contract; do not hand-edit generated types.

The helper checks are [API build argument](../scripts/tests/api-base-url-guard.test.sh), [volume ownership](../scripts/tests/docker-volume.test.sh), and [stale stack reclaim](../scripts/tests/fullstack-stale-reclaim.test.sh). The reclaim test can skip its real `hidepid=2` case when private `/proc` mounts are unavailable; CI requires it with `LEGAJO_STALE_RECLAIM_REQUIRE_HIDEPID=1`.

## Image and full-stack validation

The production image uses Node 24 to build and non-root nginx on port `8080` to serve. Supply a browser-reachable absolute `VITE_API_BASE_URL` at build time: it is embedded in the bundle. The Docker build fails if the argument is missing, blank, or contains interior whitespace; surrounding whitespace is trimmed. Compose gives its frontend build the browser-facing `http://localhost:8080` default. Without Docker, a Vite production bundle still needs a valid value when it initializes; see [environment validation](../src/infrastructure/env.ts). Vite dev can use an empty value with its proxy instead.

Once the image is running, check `docker ps` for its root-path `HEALTHCHECK`. The [smoke script](../scripts/smoke-image.sh) runs in a separate pinned curl image, with the repo mounted read-only. See [the README command](../README.md#image-smoke-test). It polls readiness up to a 30-second wall-clock limit, bounds each request, and checks:

- The root HTML and a deep route such as `/clustering` both serve the SPA shell with `Cache-Control: no-cache`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: DENY` are present. The `Server` header has no version number.
- Hashed `/assets/*` output is cacheable for a year. Empty or missing expected values fail the test.

The [mocked E2E suite](../e2e/) uses `page.route`; the [full-stack suite](../e2e-fullstack/) runs the comparison and clustering journeys against the real 20-document corpus without interception. Its guard fails if mocking is introduced. It cross-checks actual API scores (such as Needleman–Wunsch ≈ 0.0707 for reference documents `d01` and `d02`) and verifies the Ward partition. The full-stack wrapper uses the same pinned Playwright image as the mocked suite and a separate Compose project for the current checkout. It starts both services from the sibling backend's Compose file, dumps logs on failure, and tears down on exit. It defaults to `../backend`; override `LEGAJO_BACKEND_DIR` when the sibling is elsewhere. Reclamation requires matching host and PID namespace labels and a confirmed dead owner PID. Unlabelled or legacy projects are not reclaimed.

[CI](../.github/workflows/frontend.yml) covers format, lint, types, tokens, coverage, build, contract drift, mocked E2E, the shell helpers, image smoke, and separate real-stack E2E. CI's main job uses Node 24 directly; image and full-stack jobs use Docker. The full-stack job requires its configured read-only backend checkout key, which is unavailable on fork pull requests.

## Native Git deployment policy

[Vercel configuration](../vercel.json) enables Git deployments for `main` only and rewrites client routes to the SPA shell. The deployment record also specifies Vercel dashboard settings: **Production branch: main**, and **Preview Branch Tracking: Off**. Those dashboard controls are independent of the file, and disabling native preview tracking still permits manual previews. The dashboard settings were not independently rechecked for this change.

Use the [Render API](https://legajo-backend.onrender.com) as `VITE_API_BASE_URL` for the [Vercel frontend](https://legajo-frontend.vercel.app) and allow that Vercel origin in the API's CORS configuration. A Render free-tier cold start can take tens of seconds. Wait for the API's `/actuator/health` to return `200` before a live walkthrough. The nginx image supplies the same deep-route fallback for a container deployment.
