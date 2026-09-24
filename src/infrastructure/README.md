# infrastructure

HTTP client, response validation, error mapping, server-state caching, and
i18n. No React components here (the Scope Rule reserves those for
`shared/` and each feature folder).

- `env.ts` — Zod-validates `VITE_API_BASE_URL` at startup. Missing/empty
  falls back to same-origin in development (the Vite `/api` proxy handles
  it); a production build without it throws `EnvValidationError`.
- `httpClient.ts` — the app's single Axios instance: base URL from `env.ts`,
  60s timeout (Render free-tier cold start), JSON headers, and a response
  interceptor that rejects with the mapped `ApiError` instead of the raw
  Axios error.
- `apiError.ts` — `mapAxiosErrorToApiError()`, the RFC 9457 -> UI error
  model. A `kind: 'problem'` response maps its fixed URN to an
  i18n key, falling back by HTTP status when the URN is absent
  (`about:blank`) or unrecognized. A `kind: 'network'` error (timeout or no
  response) always points at the same cold-start message. A `kind:
'unexpected'` error covers anything else, including a non-Axios throw or a
  response body that fails `ProblemDetailSchema`.
- `parseResponse.ts` — validates a JSON body against its Zod schema before
  returning it; a mismatch throws (a genuine contract drift between the live
  backend and the vendored OpenAPI, not a user-facing HTTP error).
- `schemas/` — one Zod module per response family (`corpus`, `similarity`,
  `clustering`, `embeddings`, `problemDetail`). Every schema has a
  `expectTypeOf<z.infer<...>>().toEqualTypeOf<...>()` contract test against
  the generated `../shared/types/api.ts`, so `npm run typecheck` fails the
  day a contract change drops or renames a field.
- `api/` — one typed function per REST endpoint the UI consumes (`corpus`,
  `similarity`, `clustering`, `embeddings`), wrapping `httpClient` with
  request/response types taken from the generated `operations`, then
  validating the response through `parseResponse`.
- `queryRetry.ts` / `queryClient.ts` — the shared TanStack Query client:
  `staleTime: Infinity` (the corpus and everything derived from it are
  deterministic — no server-side state to go stale), no retry on a 4xx problem,
  limited retry on a 5xx problem or a network/cold-start failure. Wired into
  `main.tsx` via `QueryClientProvider`.
- `i18n/` — i18next + react-i18next, ES/EN resources under `locales/`.
  Spanish is the default (see `index.ts`'s doc comment for why); a parity
  test asserts both languages expose exactly the same key set.
  Algorithm ids and corpus terms are never translated.
