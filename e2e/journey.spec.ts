import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * TAC-15: one Playwright journey walking Flujo A (PRD §7) — select two
 * articles, compare the six capabilities, open the Needleman–Wunsch trace —
 * and Flujo B — clustering, the Ward dendrogram, the Davies–Bouldin metric,
 * and a free cut drawn on the dendrogram — with axe AA at every major step
 * (TAC-20). No live backend: `page.route` intercepts every request, the same
 * offline pattern every other spec in this suite uses.
 */

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function assertNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

// ---- Flujo A fixtures (TRD §6.6 `GET /corpus`, `GET /similarity/algorithms`,
// `POST /similarity/compare`, `GET /similarity/{algorithmId}/trace`) ----

const CORPUS_SUMMARIES_A = [
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
    algorithmId: 'tfidf-cosine',
    result: {
      normalizedScore: 0.55,
      rawValue: 0.55,
      computedNanos: 7002,
      cached: false,
      degenerate: false,
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

const NEEDLEMAN_WUNSCH_TRACE = {
  algorithmId: 'needleman-wunsch',
  rowLabels: ['', 'k', 'i', 't'],
  columnLabels: ['', 's', 'i', 't'],
  matrix: [
    [0, -1, -2, -3],
    [-1, -1, -2, -3],
    [-2, -2, 0, -1],
    [-3, -3, -1, 1],
  ],
  optimalPath: [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
    { row: 3, col: 3 },
  ],
  operations: [
    { from: { row: 0, col: 0 }, to: { row: 1, col: 1 }, operation: 'SUBSTITUTION' },
    { from: { row: 1, col: 1 }, to: { row: 2, col: 2 }, operation: 'MATCH' },
    { from: { row: 2, col: 2 }, to: { row: 3, col: 3 }, operation: 'MATCH' },
  ],
};

async function mockFlowA(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES_A });
  });
  await page.route('**/api/v1/similarity/algorithms', async (route) => {
    await route.fulfill({ json: ALGORITHM_CATALOGUE });
  });
  await page.route('**/api/v1/similarity/compare', async (route) => {
    await route.fulfill({ json: COMPARE_RESULTS });
  });
  await page.route('**/api/v1/similarity/needleman-wunsch/trace**', async (route) => {
    await route.fulfill({ json: NEEDLEMAN_WUNSCH_TRACE });
  });
}

// ---- Flujo B fixtures (TRD §6.4/§6.6 `POST /clustering`, `POST /clustering/cut`) ----

const CORPUS_SUMMARIES_B = Array.from({ length: 6 }, (_unused, index) => ({
  id: `doc-0${index + 1}`,
  title: `Article ${index + 1}`,
  authors: ['A. Author'],
}));

/**
 * Golden n = 6 linkage matrix (TRD §6.4 conventions: 5 rows, `idx1 < idx2`,
 * the cluster created by row i gets id 6 + i, non-decreasing distances) —
 * same shape the `clustering.spec.ts` suite and the unit tests validate.
 */
const GOLDEN_ROWS_N6 = [
  { idx1: 0, idx2: 1, mergeDistance: 0.1, size: 2 },
  { idx1: 2, idx2: 3, mergeDistance: 0.2, size: 2 },
  { idx1: 4, idx2: 5, mergeDistance: 0.3, size: 2 },
  { idx1: 6, idx2: 7, mergeDistance: 0.4, size: 4 },
  { idx1: 8, idx2: 9, mergeDistance: 0.5, size: 6 },
];

function evaluation(cophenetic: number, silhouetteAtKRef: number, dbAtKRef: number) {
  return {
    cophenetic,
    meanSilhouette: { '2': 0.15, '3': 0.25, '4': silhouetteAtKRef, '5': 0.35 },
    daviesBouldin: { '2': 0.6, '3': 0.5, '4': dbAtKRef, '5': 0.4 },
  };
}

const CLUSTERING_RESPONSE = [
  {
    linkageId: 'single',
    linkageDisplayName: 'Single',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    evaluation: evaluation(0.4, 0.2, 0.55),
  },
  {
    linkageId: 'complete',
    linkageDisplayName: 'Complete',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [2, 3, 0, 1, 4, 5],
    evaluation: evaluation(0.5, 0.3, 0.45),
  },
  {
    linkageId: 'average',
    linkageDisplayName: 'Average',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 4, 5, 2, 3],
    evaluation: evaluation(0.6, 0.25, 0.35),
  },
  {
    linkageId: 'ward',
    linkageDisplayName: 'Ward',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    // A defined (non-null) Davies-Bouldin at k_ref, so the journey's
    // "the DB metric is visible" step never has to read "no definido".
    evaluation: evaluation(0.35, 0.4, 0.25),
  },
];

async function mockFlowB(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES_B });
  });
  await page.route('**/api/v1/clustering', async (route) => {
    await route.fulfill({ json: CLUSTERING_RESPONSE });
  });
  await page.route('**/api/v1/clustering/cut', async (route) => {
    await route.fulfill({ json: { labels: [0, 0, 1, 1, 2, 2], k: 3 } });
  });
}

test.describe('TAC-15 journey', () => {
  test('Flujo A: select two articles, compare, and open the Needleman–Wunsch trace, axe-clean at each step', async ({
    page,
  }) => {
    await mockFlowA(page);

    // Step 1: corpus, select two articles.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Artículos del corpus' })).toBeVisible();
    await assertNoAxeViolations(page);

    await page.getByRole('checkbox', { name: CORPUS_SUMMARIES_A[0].title }).check();
    await page.getByRole('checkbox', { name: CORPUS_SUMMARIES_A[1].title }).check();

    const compareButton = page.getByRole('button', { name: 'Comparar' });
    await expect(compareButton).toBeEnabled();

    // Step 2: compare the six capabilities.
    await compareButton.click();
    await expect(page.getByRole('heading', { name: 'Comparación de similitud' })).toBeVisible();

    const rows = page.getByRole('row');
    // Header row + six results.
    await expect(rows).toHaveCount(7);
    for (const { algorithmId } of COMPARE_RESULTS) {
      await expect(page.getByRole('link', { name: algorithmId, exact: true })).toBeVisible();
    }
    await assertNoAxeViolations(page);

    // Step 3: open the Needleman–Wunsch trace and confirm the DP matrix/trace is visible.
    await page.getByRole('link', { name: 'needleman-wunsch', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Traza: needleman-wunsch' })).toBeVisible();

    // Every cell of the 4x4 matrix is present, never a truncated subset.
    await expect(page.locator('table').first().locator('td')).toHaveCount(16);
    // The optimal path is drawn (matches `optimalPath` above).
    await expect(page.locator('[data-optimal-path="true"]')).toHaveCount(4);
    await assertNoAxeViolations(page);
  });

  test('Flujo B: the Ward dendrogram renders with a visible Davies–Bouldin metric, and a free cut draws the dashed line, axe-clean at each step', async ({
    page,
  }) => {
    await mockFlowB(page);

    // Step 1: clustering screen, four dendrograms including Ward.
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Ward' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Dendrograma de Ward' })).toBeVisible();

    const wardPanel = page.getByTestId('linkage-panel-ward');
    await expect(wardPanel.getByText(/Davies–Bouldin/).first()).toBeVisible();
    await assertNoAxeViolations(page);

    // Step 2: apply a free cut on Ward at k=3 and confirm the dashed cut line is drawn on its dendrogram.
    const cutGroup = page.getByRole('radiogroup', { name: 'Enlace a cortar' });
    await cutGroup.getByRole('radio', { name: 'Ward' }).click();
    await page.getByLabel('Número de clústeres k (entre 2 y 5)').fill('3');
    await page.getByRole('button', { name: 'Aplicar corte' }).click();

    const wardDendrogram = page.getByTestId('linkage-dendrogram-ward');
    // An SVG `<line>` has a zero-area bounding box in Chromium's own
    // visibility geometry (see `clustering.spec.ts`'s own note), so a DOM
    // presence check is the correct assertion, not `toBeVisible()`.
    await expect(wardDendrogram.getByTestId('dendrogram-cut-line')).toBeAttached();
    // labels = [0, 0, 1, 1, 2, 2] over 6 leaves -> two leaves per cluster.
    await expect(wardDendrogram.getByText('Clúster 0')).toHaveCount(2);

    // No cut line leaks onto a linkage that was not cut.
    await expect(
      page.getByTestId('linkage-dendrogram-single').getByTestId('dendrogram-cut-line'),
    ).toHaveCount(0);

    await assertNoAxeViolations(page);
  });
});
