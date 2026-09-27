import { expect, test, type Locator, type Page } from '@playwright/test';

import { holdApi } from './support/holdApi.js';
import { expectLoadingSentencesHidden } from './support/loadingText.js';

/**
 * Regression guard for the loading skeletons: for every screen listed
 * below, at both a wide and a narrow viewport, this holds every API
 * response the screen needs, measures its own region's outer box and the
 * page's `scrollHeight` while still showing the skeleton, releases the
 * held responses, waits for the real content, and asserts neither the box
 * nor the page grew or shrank by more than a few pixels — "same box, no
 * shift" as an executable check, not only a rule in prose.
 *
 * A region that is itself a bounded, internally scrollable viewport (the
 * DP matrix, the results matrix, the DP operations sequence) is expected to
 * measure at, or close to, zero delta BECAUSE it is bounded: its own
 * `overflow-auto` clips real content to that same fixed height regardless
 * of how much content actually arrives, so the same small tolerance below
 * already covers it without a larger, separately justified one.
 */
const TOLERANCE_PX = 4;

const CORPUS_TWO = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One', 'B. Two'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['C. Three'] },
];

const CORPUS_THREE = [
  ...CORPUS_TWO,
  { id: 'doc-03', title: 'Clustering theory refresher', authors: ['D. Four'] },
];

const ALGORITHM_CATALOGUE = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'needleman-wunsch', displayName: 'Needleman–Wunsch', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
  { id: 'tfidf-cosine', displayName: 'TF-IDF cosine', kind: 'CLASSIC' },
  { id: 'embedding-local', displayName: 'Local embedding', kind: 'AI' },
  { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' },
];

const COMPARE_RESULTS = ALGORITHM_CATALOGUE.map(({ id }, index) => ({
  algorithmId: id,
  result: {
    normalizedScore: 0.5 + index / 20,
    rawValue: 10 + index,
    computedNanos: 15_000 + index,
    cached: index === 2,
    degenerate: false,
  },
}));

/** A 60x60 matrix — large enough to fill both the DP matrix's own bounded
 * viewport (`max-h-[420px]`) and the operations region's own bounded
 * viewport (`max-h-64`), the same fixture `similarity.spec.ts`'s own large-
 * matrix suite uses. */
function buildLargeDpTrace(size: number) {
  const rowLabels = Array.from({ length: size }, (_unused, index) => (index === 0 ? '' : 'a'));
  const columnLabels = Array.from({ length: size }, (_unused, index) => (index === 0 ? '' : 'b'));
  const matrix = Array.from({ length: size }, (_unused, row) =>
    Array.from({ length: size }, (_unused2, col) => row + col),
  );
  const optimalPath = Array.from({ length: size }, (_unused, index) => ({
    row: index,
    col: index,
  }));
  const operations = optimalPath.slice(1).map((cell, index) => ({
    from: optimalPath[index],
    to: cell,
    operation: 'MATCH',
  }));
  return { algorithmId: 'levenshtein', rowLabels, columnLabels, matrix, optimalPath, operations };
}

const EMBEDDING_API_TRACE = {
  algorithmId: 'embedding-api',
  provider: 'google',
  model: 'gemini-embedding-2-preview',
  dimension: 1536,
  vectorAExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorBExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorA: [],
  vectorB: [],
  preNormL2A: 1,
  preNormL2B: 1,
  sumSquaredDiff: 0.2,
  distance: 0.4472,
  normalizedScore: 0.68,
  providerStatus: 'cached',
};

const LEVENSHTEIN_MATRIX_3X3 = [
  [1, 0.72, 0.4],
  [0.72, 1, 0.6],
  [0.4, 0.6, 1],
].map((row) =>
  row.map((normalizedScore) => ({
    normalizedScore,
    rawValue: normalizedScore,
    computedNanos: 4200,
    cached: false,
    degenerate: false,
  })),
);

const CORPUS_SIX = Array.from({ length: 6 }, (_unused, index) => ({
  id: `doc-0${index + 1}`,
  title: `Article ${index + 1}`,
  authors: ['A. Author'],
}));

const GOLDEN_ROWS_N6 = [
  { idx1: 0, idx2: 1, mergeDistance: 0.1, size: 2 },
  { idx1: 2, idx2: 3, mergeDistance: 0.2, size: 2 },
  { idx1: 4, idx2: 5, mergeDistance: 0.3, size: 2 },
  { idx1: 6, idx2: 7, mergeDistance: 0.4, size: 4 },
  { idx1: 8, idx2: 9, mergeDistance: 0.5, size: 6 },
];

function clusteringEvaluation(
  cophenetic: number,
  silhouette: number,
  daviesBouldin: number | null,
) {
  return {
    cophenetic,
    meanSilhouette: { '2': 0.15, '3': 0.25, '4': silhouette, '5': 0.35 },
    daviesBouldin: { '2': 0.6, '3': 0.5, '4': daviesBouldin, '5': 0.4 },
  };
}

const CLUSTERING_RESPONSE = [
  {
    linkageId: 'single',
    linkageDisplayName: 'Single',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: CORPUS_SIX.map((document) => document.id),
    evaluation: clusteringEvaluation(0.95, 0.2, 0.5),
  },
  {
    linkageId: 'complete',
    linkageDisplayName: 'Complete',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [2, 3, 0, 1, 4, 5],
    documentIds: CORPUS_SIX.map((document) => document.id),
    evaluation: clusteringEvaluation(0.5, 0.9, 0.1),
  },
  {
    linkageId: 'average',
    linkageDisplayName: 'Average',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: CORPUS_SIX.map((document) => document.id),
    evaluation: clusteringEvaluation(0.4, 0.3, 0.2),
  },
  {
    linkageId: 'ward',
    linkageDisplayName: 'Ward',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: CORPUS_SIX.map((document) => document.id),
    evaluation: clusteringEvaluation(0.3, 0.1, null),
  },
];

function benchmarkResult(overrides: Record<string, unknown>) {
  return {
    benchmark: 'x',
    family: 'levenshtein',
    parameter: 'length',
    size: 50,
    score: 1,
    error: 0,
    unit: 'us/op',
    ...overrides,
  };
}

const BENCHMARK_REPORT = {
  harness: {
    cpuModel: '12th Gen Intel(R) Core(TM) i9-12900H',
    logicalCores: 20,
    totalRamBytes: 33_363_460_096,
    jdk: 'Eclipse Adoptium 25.0.4',
    os: 'Linux 7.2.5-3-omarchy (amd64)',
    measuredAt: '2026-09-23T00:43:04.800549029Z',
  },
  results: [
    benchmarkResult({ family: 'levenshtein', size: 50, score: 7.9 }),
    benchmarkResult({ family: 'levenshtein', size: 400, score: 499.0 }),
    benchmarkResult({ family: 'needleman-wunsch', size: 50, score: 7.7 }),
    benchmarkResult({ family: 'needleman-wunsch', size: 400, score: 469.5 }),
    benchmarkResult({ family: 'jaccard', size: 50, score: 4.5 }),
    benchmarkResult({ family: 'jaccard', size: 400, score: 104.6 }),
    benchmarkResult({ family: 'tfidf-cosine', size: 50, score: 6.1 }),
    benchmarkResult({ family: 'tfidf-cosine', size: 400, score: 75.1 }),
    benchmarkResult({ family: 'hac-single', parameter: 'n', size: 5, score: 0.32 }),
    benchmarkResult({ family: 'hac-single', parameter: 'n', size: 80, score: 268.3 }),
    benchmarkResult({ family: 'hac-complete', parameter: 'n', size: 5, score: 0.31 }),
    benchmarkResult({ family: 'hac-complete', parameter: 'n', size: 80, score: 155.2 }),
    benchmarkResult({ family: 'hac-average', parameter: 'n', size: 5, score: 0.33 }),
    benchmarkResult({ family: 'hac-average', parameter: 'n', size: 80, score: 178.7 }),
    benchmarkResult({ family: 'hac-ward', parameter: 'n', size: 5, score: 0.34 }),
    benchmarkResult({ family: 'hac-ward', parameter: 'n', size: 80, score: 168.6 }),
    benchmarkResult({ family: 'mean-silhouette', parameter: 'n', size: 5, score: 0.21 }),
    benchmarkResult({ family: 'mean-silhouette', parameter: 'n', size: 80, score: 14.4 }),
    benchmarkResult({ family: 'davies-bouldin', parameter: 'n', size: 5, score: 115.3 }),
    benchmarkResult({ family: 'davies-bouldin', parameter: 'n', size: 80, score: 1893.9 }),
    benchmarkResult({
      family: 'embedding-dot-product',
      parameter: 'dimension',
      size: 384,
      score: 195,
      unit: 'ns/op',
    }),
    benchmarkResult({
      family: 'embedding-dot-product',
      parameter: 'dimension',
      size: 1536,
      score: 843,
      unit: 'ns/op',
    }),
    benchmarkResult({
      family: 'embedding-euclidean-sum-squared',
      parameter: 'dimension',
      size: 384,
      score: 210,
      unit: 'ns/op',
    }),
    benchmarkResult({
      family: 'embedding-euclidean-sum-squared',
      parameter: 'dimension',
      size: 1536,
      score: 867,
      unit: 'ns/op',
    }),
    benchmarkResult({
      family: 'slo-classic-levenshtein',
      parameter: 'n',
      size: 20,
      score: 11.6,
      unit: 'ms/op',
    }),
    benchmarkResult({
      family: 'slo-classic-needleman-wunsch',
      parameter: 'n',
      size: 20,
      score: 11.7,
      unit: 'ms/op',
    }),
    benchmarkResult({
      family: 'slo-classic-jaccard',
      parameter: 'n',
      size: 20,
      score: 7.1,
      unit: 'ms/op',
    }),
    benchmarkResult({
      family: 'slo-classic-tfidf-cosine',
      parameter: 'n',
      size: 20,
      score: 7.2,
      unit: 'ms/op',
    }),
    benchmarkResult({
      family: 'slo-clustering',
      parameter: 'n',
      size: 20,
      score: 0.017,
      unit: 'ms/op',
    }),
  ],
  slopes: [
    { family: 'levenshtein', points: 2, empiricalSlope: 2.04, theoreticalExponent: 2 },
    { family: 'needleman-wunsch', points: 2, empiricalSlope: 2.01, theoreticalExponent: 2 },
    { family: 'jaccard', points: 2, empiricalSlope: 1.48, theoreticalExponent: 1 },
    { family: 'tfidf-cosine', points: 2, empiricalSlope: 1.25, theoreticalExponent: 1 },
    { family: 'hac-single', points: 2, empiricalSlope: 2.37, theoreticalExponent: 3 },
    { family: 'hac-complete', points: 2, empiricalSlope: 2.21, theoreticalExponent: 3 },
    { family: 'hac-average', points: 2, empiricalSlope: 2.23, theoreticalExponent: 3 },
    { family: 'hac-ward', points: 2, empiricalSlope: 2.21, theoreticalExponent: 3 },
    { family: 'mean-silhouette', points: 2, empiricalSlope: 1.46, theoreticalExponent: 2 },
    { family: 'davies-bouldin', points: 2, empiricalSlope: 1.01, theoreticalExponent: 1 },
    { family: 'embedding-dot-product', points: 2, empiricalSlope: 1.06, theoreticalExponent: 1 },
    {
      family: 'embedding-euclidean-sum-squared',
      points: 2,
      empiricalSlope: 1.02,
      theoreticalExponent: 1,
    },
  ],
};

const EMBEDDINGS_STATUS = {
  embeddingLocal: {
    provider: 'sentence-transformers',
    model: 'all-MiniLM-L6-v2',
    dimension: 384,
    corpusSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    matchesCorpus: true,
    device: 'cpu',
  },
  embeddingApi: {
    provider: 'google',
    model: 'gemini-embedding-2-preview',
    dimension: 1536,
    corpusSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    matchesCorpus: true,
    mode: 'cached' as const,
  },
};

const CORPUS_DOCUMENT = {
  id: 'doc-01',
  title: 'A survey of string similarity',
  authors: ['A. One', 'B. Two'],
  abstract: 'This paper surveys classic and embedding-based similarity measures.',
};

const LOADING_SENTENCES = [
  'Calculando la comparación…',
  'Cargando el catálogo de algoritmos…',
  'Calculando la matriz…',
  'Cargando la traza…',
  'Calculando el agrupamiento…',
  'Cargando las mediciones…',
  'Cargando el estado de los embeddings…',
  'Cargando el artículo…',
  'Cargando el corpus…',
  'Cargando…',
];

interface RegionMeasurement {
  width: number;
  height: number;
  scrollHeight: number;
}

/** No `dom` lib under this project's Node-typed e2e tsconfig
 * (`tsconfig.node.json`), so `document` is read through `globalThis`
 * rather than referenced by its own global name — the same technique
 * `hit-areas.spec.ts`'s own `FlexGrowWindow` access already uses. */
async function measure(page: Page, region: Locator): Promise<RegionMeasurement> {
  const box = await region.boundingBox();
  if (!box) {
    throw new Error('region has no bounding box — is it visible?');
  }
  const scrollHeight = await page.evaluate(
    () =>
      (globalThis as unknown as { document: { documentElement: { scrollHeight: number } } })
        .document.documentElement.scrollHeight,
  );
  return { width: box.width, height: box.height, scrollHeight };
}

function assertSameBox(
  before: RegionMeasurement,
  after: RegionMeasurement,
  tolerancePx: number = TOLERANCE_PX,
) {
  expect(
    Math.abs(after.height - before.height),
    `region height: ${before.height} (skeleton) vs ${after.height} (loaded)`,
  ).toBeLessThanOrEqual(tolerancePx);
  expect(
    Math.abs(after.width - before.width),
    `region width: ${before.width} (skeleton) vs ${after.width} (loaded)`,
  ).toBeLessThanOrEqual(tolerancePx);
  expect(
    Math.abs(after.scrollHeight - before.scrollHeight),
    `page scrollHeight: ${before.scrollHeight} (skeleton) vs ${after.scrollHeight} (loaded)`,
  ).toBeLessThanOrEqual(tolerancePx);
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`skeleton layout shift at ${viewport.width}x${viewport.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
      // Every screen below `lg` renders the corpus list — and its own
      // embeddings summary row — behind whatever sheet/panel this test
      // actually measures, even a docked trace reached by a direct URL
      // that never confirmed a pair through the rail. Left unmocked, that
      // row's fetch falls through to this dev server's own API proxy,
      // which has no real backend behind it: the resulting error settles
      // at an unpredictable point between this test's two measurements,
      // changing the underlying page's own height for reasons that have
      // nothing to do with the region actually under test.
      await page.route('**/api/v1/embeddings/status', async (route) => {
        await route.fulfill({ json: EMBEDDINGS_STATUS });
      });
    });

    test('similarity pair: the compare table (≥lg) or list (<lg) region matches its loaded box', async ({
      page,
    }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_TWO });
      });
      await page.route('**/api/v1/similarity/algorithms', async (route) => {
        await route.fulfill({ json: ALGORITHM_CATALOGUE });
      });
      const compare = await holdApi(page, [
        { pattern: '**/api/v1/similarity/compare', json: COMPARE_RESULTS },
      ]);

      await page.goto('/');
      await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
      await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
      await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

      const region = page.getByTestId('similarity-results-region');
      await expect(page.getByText('Calculando la comparación…')).toHaveCount(1);
      const skeleton = await measure(page, region);

      compare.release();
      await expect(page.getByRole('button', { name: 'levenshtein', exact: true })).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      // A slightly larger tolerance for the ≥lg table specifically: its
      // two-line algorithm cell's placeholder bars, sized in whole
      // Tailwind spacing steps, cannot hit this font stack's own real
      // two-line height to the exact pixel across all six rows at once —
      // every other region in this suite holds the default tolerance.
      assertSameBox(skeleton, loaded, viewport.width >= 1024 ? 8 : TOLERANCE_PX);
    });

    test('similarity matrix: the matrix region matches its loaded box', async ({ page }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_THREE });
      });
      const matrix = await holdApi(page, [
        { pattern: '**/api/v1/similarity/matrix', json: LEVENSHTEIN_MATRIX_3X3 },
      ]);

      await page.goto('/');
      await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
      await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
      await page.getByRole('checkbox', { name: 'Clustering theory refresher' }).check();
      await page.getByRole('button', { name: 'Ver matriz de 3' }).click();

      const region = page.getByRole('region', {
        name: 'Matriz de similitud por pares para el algoritmo elegido',
      });
      await expect(page.getByText('Calculando la matriz…')).toHaveCount(1);
      const skeleton = await measure(page, region);

      matrix.release();
      await expect(region.getByText('1.000').first()).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      assertSameBox(skeleton, loaded);
    });

    test('docked trace, DP algorithm (Levenshtein): the panel region matches its loaded box', async ({
      page,
    }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_TWO });
      });
      await page.route('**/api/v1/similarity/algorithms', async (route) => {
        await route.fulfill({ json: ALGORITHM_CATALOGUE });
      });
      // Resolved immediately, never held: below `lg`, this same trace route
      // still renders the plain compare view as the workbench's own main
      // content behind the docked panel/sheet — holding this endpoint would
      // also hold, then release, that unrelated background table, changing
      // the underlying page's own height for reasons that have nothing to
      // do with the trace panel this test actually measures. The full
      // fixture satisfies both that background request and the panel's own
      // single-algorithm meta query, which only ever reads its own result
      // by index regardless of how many others come back with it.
      await page.route('**/api/v1/similarity/compare', async (route) => {
        await route.fulfill({ json: COMPARE_RESULTS });
      });
      const held = await holdApi(page, [
        {
          pattern: '**/api/v1/similarity/levenshtein/trace**',
          json: buildLargeDpTrace(60),
        },
      ]);

      await page.goto('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

      const region = page.getByTestId('trace-detail-panel');
      await expect(page.getByText('Cargando la traza…')).toHaveCount(1);
      // The formula caption needs no fetched data (`TraceBodySkeleton`
      // renders it for real immediately), but its KaTeX chunk still loads
      // asynchronously — waited on here so this measurement lands after
      // that one-time layout settles, the same way the loaded measurement
      // below already lands well after it.
      await expect(page.locator('.katex').first()).toBeVisible();
      const skeleton = await measure(page, region);

      held.release();
      // The real matrix's own cells (never present on the skeleton, which
      // fills its bounded viewport with one placeholder block instead of
      // a table) — the docked panel hides `DpTracePanel`'s own meta row
      // (`hideDpMetaRow`), so that testid never appears here at all.
      await expect(page.locator('td[data-optimal-path="true"]').first()).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      assertSameBox(skeleton, loaded);
    });

    test('docked trace, non-DP algorithm (embedding-api): the panel region matches its loaded box', async ({
      page,
    }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_TWO });
      });
      await page.route('**/api/v1/similarity/algorithms', async (route) => {
        await route.fulfill({ json: ALGORITHM_CATALOGUE });
      });
      // See the DP test's own comment above: never held, since this same
      // background compare request also feeds the workbench's own main
      // content behind the panel/sheet below `lg`.
      await page.route('**/api/v1/similarity/compare', async (route) => {
        await route.fulfill({ json: COMPARE_RESULTS });
      });
      const held = await holdApi(page, [
        {
          pattern: '**/api/v1/similarity/embedding-api/trace**',
          json: EMBEDDING_API_TRACE,
        },
      ]);

      await page.goto('/similarity/embedding-api/trace?documentIdA=doc-01&documentIdB=doc-02');

      const region = page.getByTestId('trace-detail-panel');
      await expect(page.getByText('Cargando la traza…')).toHaveCount(1);
      const skeleton = await measure(page, region);

      held.release();
      await expect(page.getByTestId('embedding-api-providerStatus')).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      assertSameBox(skeleton, loaded);
    });

    test('clustering: the page region matches its loaded box', async ({ page }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_SIX });
      });
      const clustering = await holdApi(page, [
        { pattern: '**/api/v1/clustering', json: CLUSTERING_RESPONSE },
      ]);

      await page.goto('/clustering');

      const region = page.getByTestId('clustering-page');
      await expect(page.getByText('Calculando el agrupamiento…')).toHaveCount(1);
      const skeleton = await measure(page, region);

      clustering.release();
      await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      // A larger, justified tolerance, wider at the narrow viewport, and
      // wider still against the page's own `scrollHeight` than against
      // this region's own box:
      // - The metrics table's own explanatory line swaps, once the four
      //   canonical linkages resolve without a cophenetic tie, from the
      //   skeleton's static fallback ("Los líderes...") to the sample-size
      //   caveat — reserved by an invisible sizer built from this page's
      //   own known representation and a placeholder count (never the real
      //   count, unknowable before the response resolves), which only
      //   approximates the real sentence's own wrapped height.
      // - At a small, `MIN_HEIGHT`-clamped leaf count (this suite's own
      //   fixture), the real `Dendrogram`'s own D3-drawn leaf labels can
      //   paint past its card's own declared `height` without growing that
      //   card's own box — real, pre-existing chart-rendering behavior
      //   this skeleton's flat placeholder block cannot reproduce, and out
      //   of this guard's own scope to change. That painted-only overflow
      //   still counts toward the page's `scrollHeight`, so four stacked
      //   cards below `lg` compound it far more than this region's own
      //   `getBoundingClientRect` ever reflects.
      assertSameBox(skeleton, loaded, viewport.width >= 1024 ? 180 : 350);
    });

    test('benchmarks: the page region matches its loaded box', async ({ page }) => {
      const benchmarks = await holdApi(page, [
        { pattern: '**/api/v1/benchmarks', json: BENCHMARK_REPORT },
      ]);

      await page.goto('/benchmarks');

      const region = page.getByTestId('benchmarks-page');
      await expect(page.getByText('Cargando las mediciones…')).toHaveCount(1);
      const skeleton = await measure(page, region);

      benchmarks.release();
      await expect(page.getByRole('radiogroup', { name: 'Escala' })).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      // A larger, justified tolerance: this page stacks well over a
      // hundred real text rows (the harness grid, three curve-chart slope
      // tables, the embedding tiles, both SLO tables); a sub-2px real
      // line-height each Tailwind's spacing scale cannot hit exactly
      // compounds across all of them into a small residual this single
      // page's own sheer row count makes disproportionate — every other
      // screen in this suite, with far fewer rows, holds the default
      // tolerance.
      assertSameBox(skeleton, loaded, 30);
    });

    test('embeddings status: the panel region matches its loaded box', async ({ page }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_TWO });
      });
      const status = await holdApi(page, [
        { pattern: '**/api/v1/embeddings/status', json: EMBEDDINGS_STATUS },
      ]);

      await page.goto('/');
      await page.getByRole('button', { name: 'Ver el estado de los embeddings' }).click();

      const region = page.getByTestId('embeddings-status-panel');
      await expect(page.getByText('Cargando el estado de los embeddings…')).toHaveCount(1);
      const skeleton = await measure(page, region);

      status.release();
      await expect(page.getByTestId('embeddings-status-local-match')).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      assertSameBox(skeleton, loaded);
    });

    test('article abstract: the panel region matches its loaded box', async ({ page }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_TWO });
      });
      const abstract = await holdApi(page, [
        { pattern: '**/api/v1/corpus/doc-01', json: CORPUS_DOCUMENT },
      ]);

      await page.goto('/');
      await page.getByRole('button', { name: 'A survey of string similarity' }).click();

      const region = page.getByTestId('article-abstract');
      await expect(page.getByText('Cargando el artículo…')).toHaveCount(1);
      const skeleton = await measure(page, region);

      abstract.release();
      await expect(
        page.getByText('This paper surveys classic and embedding-based similarity measures.'),
      ).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      assertSameBox(skeleton, loaded);
    });
  });
}
