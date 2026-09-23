import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Real backend origin the specs call directly (not through the frontend's
 * runtime `VITE_API_BASE_URL` bundle constant, which the browser under test
 * already uses on its own) — to fetch the real corpus ids/titles a test
 * needs to drive the UI, and to cross-check a UI-rendered value against the
 * backend's own response for the same request (F3: "check a few against the
 * backend directly, e.g. NW(d01,d02) ~= 0.0707"). Defaults to the Compose
 * stack's published backend port (TRD §14.2); overridable for a non-default
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
 * (`GET /api/v1/corpus`, TRD §6.1: 20 documents, ids `d01..d20`). Used to
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
      `document '${id}' was not found in the real corpus (expected the versioned d01..d20 corpus, TRD §6.1)`,
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

/**
 * Records every request the page makes whose URL starts with the real
 * backend origin. Every flow spec asserts this list is non-empty for its
 * own screen: this suite never intercepts a response (no `page.route`/
 * `context.route` anywhere, enforced separately by `no-mocks.guard.spec.ts`),
 * so a non-empty list here is direct, per-test proof that the browser
 * itself reached the real backend over the network for that screen, not a
 * cached/mocked/same-origin response.
 */
export function trackBackendRequests(page: Page): { urls: string[] } {
  const state = { urls: [] as string[] };
  page.on('request', (request) => {
    if (request.url().startsWith(BACKEND_BASE_URL)) {
      state.urls.push(request.url());
    }
  });
  return state;
}
