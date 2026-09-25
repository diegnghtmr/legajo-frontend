import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped payloads (`GET /corpus`, `GET /similarity/algorithms`,
 * `POST /similarity/compare`) — no live backend: `page.route` intercepts every
 * request so this suite runs fully offline.
 */
const CORPUS_SUMMARIES = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One', 'B. Two'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['C. Three'] },
];

const ALGORITHM_CATALOGUE = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'needleman-wunsch', displayName: 'Needleman–Wunsch', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
  { id: 'tfidf-cosine', displayName: 'TF-IDF cosine', kind: 'CLASSIC' },
  { id: 'embedding-local', displayName: 'Local embedding', kind: 'AI' },
  { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' },
];

const COMPARE_RESULTS = [
  {
    algorithmId: 'levenshtein',
    result: {
      normalizedScore: 0.72,
      rawValue: 84,
      computedNanos: 15234,
      cached: false,
      degenerate: false,
    },
  },
  {
    algorithmId: 'needleman-wunsch',
    result: {
      normalizedScore: 0.68,
      rawValue: 51,
      computedNanos: 18211,
      cached: false,
      degenerate: false,
    },
  },
  {
    algorithmId: 'jaccard',
    result: {
      normalizedScore: 0.41,
      rawValue: 0.41,
      computedNanos: 9021,
      cached: false,
      degenerate: false,
    },
  },
  {
    // Degenerate TF-IDF case: one empty preprocessed token stream,
    // rawValue is null and degenerate is true.
    algorithmId: 'tfidf-cosine',
    result: {
      normalizedScore: 0,
      rawValue: null,
      computedNanos: 7002,
      cached: false,
      degenerate: true,
    },
  },
  {
    algorithmId: 'embedding-local',
    result: {
      normalizedScore: 0.83,
      rawValue: 0.83,
      computedNanos: 512044,
      cached: false,
      degenerate: false,
    },
  },
  {
    // Served from cache (the `cached` marker).
    algorithmId: 'embedding-api',
    result: {
      normalizedScore: 0.79,
      rawValue: 0.79,
      computedNanos: 998,
      cached: true,
      degenerate: false,
    },
  },
];

async function mockSimilarityApi(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/similarity/algorithms', async (route) => {
    await route.fulfill({ json: ALGORITHM_CATALOGUE });
  });
  await page.route('**/api/v1/similarity/compare', async (route) => {
    await route.fulfill({ json: COMPARE_RESULTS });
  });
}

test.describe('similarity compare screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockSimilarityApi(page);
  });

  test('selecting two articles and comparing shows all six results with cached and degenerate markers', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();

    const compareButton = page.getByRole('button', { name: 'Comparar doc-01 y doc-02' });
    await expect(compareButton).toBeEnabled();
    await compareButton.click();

    await expect(page.getByRole('heading', { name: 'Comparación de similitud' })).toBeVisible();

    const rows = page.getByRole('row');
    // Header row + six results.
    await expect(rows).toHaveCount(7);

    for (const { algorithmId } of COMPARE_RESULTS) {
      // Scoped to the row: the family filter above the table has its own
      // same-named toggle button for every algorithm id.
      const row = page.getByRole('row', { name: algorithmId });
      await expect(row.getByRole('button', { name: algorithmId, exact: true })).toBeVisible();
    }

    const degenerateRow = page.getByRole('row', { name: /tfidf-cosine/ });
    await expect(degenerateRow.getByText('—')).toBeVisible();
    await expect(degenerateRow.getByText('Sí')).toBeVisible();

    const cachedRow = page.getByRole('row', { name: /embedding-api/ });
    await expect(cachedRow.getByText('en caché')).toBeVisible();

    const nonCachedRow = page.getByRole('row', { name: /^levenshtein/ });
    await expect(nonCachedRow.getByText('en caché')).toHaveCount(0);
  });

  test("opens a row's trace from a click on a cell other than the algorithm one", async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    await expect(page.getByRole('row')).toHaveCount(7);

    const row = page.getByRole('row', { name: /^levenshtein/ });
    // The time column, the fourth of the row's own `cell`s (family, score,
    // raw, time, degenerate) — nowhere near the algorithm button — proves
    // the row itself is the trace trigger, not only the box the button
    // visually sits in.
    await row.getByRole('cell').nth(3).click();

    await expect(page).toHaveURL(/\/similarity\/levenshtein\/trace/);
    await expect(row).toHaveAttribute('aria-current', 'true');
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the compare results', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    await expect(page.getByRole('row')).toHaveCount(7);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
