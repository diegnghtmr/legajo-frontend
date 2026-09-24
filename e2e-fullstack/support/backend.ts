import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Real backend origin the specs call directly (not through the frontend's
 * runtime `VITE_API_BASE_URL` bundle constant, which the browser under test
 * already uses on its own) — to fetch the real corpus ids/titles a test
 * needs to drive the UI, and to cross-check a UI-rendered value against the
 * backend's own response for the same request (check a few against the
 * backend directly, e.g. NW(d01,d02) ~= 0.0707). Defaults to the Compose
 * stack's published backend port; overridable for a non-default
 * `docker-compose.yml` port mapping.
 */
export const BACKEND_BASE_URL = (
  process.env.E2E_BACKEND_BASE_URL ?? 'http://localhost:8080'
).replace(/\/+$/, '');

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface CorpusSummary {
  id: string;
  title: string;
  authors: string[];
}

/**
 * Fetches the real, versioned corpus straight from the backend
 * (`GET /api/v1/corpus`: 20 documents, ids `d01..d20`). Used to
 * resolve real document titles for driving the UI, instead of hardcoding a
 * long title string a corpus content change would silently break.
 */
export async function fetchCorpus(request: APIRequestContext): Promise<CorpusSummary[]> {
  const response = await request.get(`${BACKEND_BASE_URL}/api/v1/corpus`);
  if (!response.ok()) {
    throw new Error(
      `GET ${BACKEND_BASE_URL}/api/v1/corpus (real backend) returned ${response.status()}; is the full-stack Compose stack up?`,
    );
  }
  return (await response.json()) as CorpusSummary[];
}

export function titleOf(corpus: readonly CorpusSummary[], id: string): string {
  const document = corpus.find((candidate) => candidate.id === id);
  if (!document) {
    throw new Error(
      `document '${id}' was not found in the real corpus (expected the versioned d01..d20 corpus)`,
    );
  }
  return document.title;
}

export interface SimilarityCompareResult {
  algorithmId: string;
  result: {
    normalizedScore: number;
    rawValue: number | null;
    computedNanos: number;
    cached: boolean;
    degenerate: boolean;
  };
}

/**
 * Calls `POST /api/v1/similarity/compare` on the real backend directly, so a
 * spec can assert a UI-rendered score against the backend's own number for
 * the exact same pair/algorithm, independent of anything the page rendered.
 */
export async function fetchSimilarityCompare(
  request: APIRequestContext,
  documentIdA: string,
  documentIdB: string,
  algorithmIds: readonly string[],
): Promise<SimilarityCompareResult[]> {
  const response = await request.post(`${BACKEND_BASE_URL}/api/v1/similarity/compare`, {
    data: { documentIdA, documentIdB, algorithmIds },
  });
  if (!response.ok()) {
    throw new Error(
      `POST ${BACKEND_BASE_URL}/api/v1/similarity/compare (real backend) returned ${response.status()}`,
    );
  }
  return (await response.json()) as SimilarityCompareResult[];
}

export interface BackendResponse {
  url: string;
  status: number;
}

export interface SimilarityTrace {
  algorithmId: string;
  rowLabels: string[];
  columnLabels: string[];
  matrix: number[][];
  optimalPath: Array<{ row: number; col: number }>;
}

/**
 * Calls `GET /api/v1/similarity/{algorithmId}/trace` on the real backend
 * directly, so a spec can assert the UI-rendered DP matrix/optimal-path
 * against the real matrix dimensions and real path length for the exact
 * same pair, instead of only asserting "at least one cell/path mark exists"
 * (which a matrix rendered with a single stray cell would also satisfy).
 */
export async function fetchSimilarityTrace(
  request: APIRequestContext,
  algorithmId: string,
  documentIdA: string,
  documentIdB: string,
): Promise<SimilarityTrace> {
  const url = `${BACKEND_BASE_URL}/api/v1/similarity/${algorithmId}/trace?documentIdA=${encodeURIComponent(documentIdA)}&documentIdB=${encodeURIComponent(documentIdB)}`;
  const response = await request.get(url);
  if (!response.ok()) {
    throw new Error(`GET ${url} (real backend) returned ${response.status()}`);
  }
  return (await response.json()) as SimilarityTrace;
}

/**
 * Records every RESPONSE the page receives whose URL starts at the real
 * backend origin — deliberately a `response` listener, not a `request`
 * listener. `page.on('request')` fires the moment the browser DISPATCHES a
 * request, before anything comes back: a request that is later aborted,
 * refused, or times out still fires that event, so a check built on it
 * (`urls.some(...)`) can report "reached the backend" for a request that
 * never actually completed — proving only that the browser tried, not that
 * it succeeded. `response` only fires once an HTTP response has actually
 * been received, and carries its real status code, so
 * `hasSuccessfulResponse` below is direct, per-test proof of a completed
 * round trip with a successful (2xx) status from the real backend origin —
 * not merely an attempted one. This suite never intercepts a response (no
 * `page.route`/`context.route` anywhere, enforced separately by
 * `no-mocks.guard.spec.ts`), so that response can only have come from the
 * real network.
 */
export function trackBackendResponses(page: Page): { responses: BackendResponse[] } {
  const state = { responses: [] as BackendResponse[] };
  page.on('response', (response) => {
    if (response.url().startsWith(BACKEND_BASE_URL)) {
      state.responses.push({ url: response.url(), status: response.status() });
    }
  });
  return state;
}

/**
 * True when at least one recorded response's URL contains `urlSubstring`
 * and its status is a successful (2xx) one.
 */
export function hasSuccessfulResponse(
  state: { responses: readonly BackendResponse[] },
  urlSubstring: string,
): boolean {
  return state.responses.some(
    (response) =>
      response.url.includes(urlSubstring) && response.status >= 200 && response.status < 300,
  );
}
