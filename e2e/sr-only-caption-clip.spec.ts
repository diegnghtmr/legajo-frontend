import { expect, test, type Page } from '@playwright/test';

import { expectNoEscapingSrOnlyCaptions } from './support/srOnlyClip.js';

/**
 * Regression guard for two sr-only accessibility tables whose own `<table>`
 * element (not its `<caption>`) carried the `sr-only` class directly: the
 * clustering dendrogram's per-linkage merge-order table
 * (`Dendrogram.tsx`) and the benchmarks curve chart's raw data table
 * (`BenchmarkCurveChart.tsx`). Both used to escape their own clip — see
 * `srOnlyClip.ts`'s own doc comment for the CSS table wrapper-box mechanism
 * — rendering the caption's full text, wrapped one word per line, over the
 * chart or the next section heading. This suite also guards the resulting
 * dead scrollable space at the bottom of the clustering screen, which the
 * same escaping, absolutely positioned boxes used to add past the last
 * visible card.
 */
const CORPUS_SUMMARIES = Array.from({ length: 6 }, (_unused, index) => ({
  id: `doc-0${index + 1}`,
  title: `Article ${index + 1}`,
  authors: ['A. Author'],
}));
const DOCUMENT_IDS = CORPUS_SUMMARIES.map((document) => document.id);

function evaluation(cophenetic: number, silhouetteAtKRef: number, dbAtKRef: number | null) {
  return {
    cophenetic,
    meanSilhouette: { '2': 0.15, '3': 0.25, '4': silhouetteAtKRef, '5': 0.35 },
    daviesBouldin: { '2': 0.6, '3': 0.5, '4': dbAtKRef, '5': 0.4 },
  };
}

/** Golden n = 6 linkage matrix — same shape `clustering.spec.ts`'s own
 * `GOLDEN_ROWS_N6` uses. */
const GOLDEN_ROWS_N6 = [
  { idx1: 0, idx2: 1, mergeDistance: 0.1, size: 2 },
  { idx1: 2, idx2: 3, mergeDistance: 0.2, size: 2 },
  { idx1: 4, idx2: 5, mergeDistance: 0.3, size: 2 },
  { idx1: 6, idx2: 7, mergeDistance: 0.4, size: 4 },
  { idx1: 8, idx2: 9, mergeDistance: 0.5, size: 6 },
];

const CLUSTERING_RESPONSE = ['single', 'complete', 'average', 'ward'].map((linkageId) => ({
  linkageId,
  linkageDisplayName: linkageId[0]!.toUpperCase() + linkageId.slice(1),
  rows: GOLDEN_ROWS_N6,
  leafOrder: [0, 1, 2, 3, 4, 5],
  documentIds: DOCUMENT_IDS,
  evaluation: evaluation(0.5, 0.2, 0.3),
}));

async function mockClusteringApi(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/clustering', async (route) => {
    await route.fulfill({ json: CLUSTERING_RESPONSE });
  });
}

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

/** One family per curve group — enough for `BenchmarkCurveChart` to render
 * a real, non-empty sr-only data table under each of the three group
 * headings, without this fixture's own full catalogue
 * (`benchmarks.spec.ts`'s `BENCHMARK_REPORT`). */
const BENCHMARK_REPORT = {
  harness: {
    cpuModel: 'Test CPU',
    logicalCores: 8,
    totalRamBytes: 16_000_000_000,
    jdk: 'Test JDK',
    os: 'Test OS',
    measuredAt: '2026-09-23T00:00:00Z',
  },
  results: [
    benchmarkResult({ family: 'levenshtein', size: 50, score: 7.9 }),
    benchmarkResult({ family: 'levenshtein', size: 400, score: 499.0 }),
    benchmarkResult({ family: 'hac-single', parameter: 'n', size: 5, score: 0.32 }),
    benchmarkResult({ family: 'hac-single', parameter: 'n', size: 80, score: 268.3 }),
    benchmarkResult({ family: 'mean-silhouette', parameter: 'n', size: 5, score: 0.21 }),
    benchmarkResult({ family: 'mean-silhouette', parameter: 'n', size: 80, score: 14.4 }),
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
      family: 'slo-classic-levenshtein',
      parameter: 'n',
      size: 20,
      score: 11.6,
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
    { family: 'hac-single', points: 2, empiricalSlope: 2.37, theoreticalExponent: 3 },
    { family: 'mean-silhouette', points: 2, empiricalSlope: 1.46, theoreticalExponent: 2 },
    { family: 'embedding-dot-product', points: 2, empiricalSlope: 1.06, theoreticalExponent: 1 },
  ],
};

async function mockBenchmarksApi(page: Page) {
  await page.route('**/api/v1/benchmarks', async (route) => {
    await route.fulfill({ json: BENCHMARK_REPORT });
  });
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`sr-only data table captions at ${viewport.width}x${viewport.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
    });

    test('clustering: every dendrogram merge-table caption stays clipped, never overlapping its own chart', async ({
      page,
    }) => {
      await mockClusteringApi(page);
      await page.goto('/clustering');
      await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

      for (const linkageId of ['single', 'complete', 'average', 'ward']) {
        await expectNoEscapingSrOnlyCaptions(page.getByTestId(`linkage-dendrogram-${linkageId}`));
      }
    });

    test('benchmarks: every curve chart data-table caption stays clipped, never overlapping the next group heading', async ({
      page,
    }) => {
      await mockBenchmarksApi(page);
      await page.goto('/benchmarks');
      await expect(
        page.getByRole('heading', { name: 'Benchmarks de rendimiento (JMH)' }),
      ).toBeVisible();

      // The whole page, not each chart's own `role="group"`: that group
      // wraps only the `LineChart` and its x-axis title
      // (`BenchmarkCurveChart.tsx`) — the sr-only data table sits as a
      // later sibling inside the same `Panel`, outside that group, exactly
      // where its escaping caption used to land on the *next* chart's own
      // section heading below it.
      await expectNoEscapingSrOnlyCaptions(page.getByTestId('benchmarks-page'));
    });
  });
}

test.describe('clustering: no dead scrollable space below the last dendrogram row', () => {
  for (const viewport of VIEWPORTS) {
    test(`at ${viewport.width}x${viewport.height}, the page's scrollable height ends at the last visible card, not far past it`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockClusteringApi(page);
      await page.goto('/clustering');
      await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

      const lastCard = page.getByTestId('linkage-dendrogram-ward');
      await expect(lastCard).toBeVisible();

      // A string body (not an arrow function) so this evaluates in the
      // browser without pulling the `dom` lib into this project's Node-typed
      // e2e tsconfig (`tsconfig.node.json`) — same technique
      // `clustering.spec.ts`'s own `scrollWidth` reads already use.
      const scrollHeight = await page.evaluate<number>('document.documentElement.scrollHeight');
      const cardBottomInDocument = await lastCard.evaluate(
        (el) =>
          el.getBoundingClientRect().bottom +
          (globalThis as unknown as { scrollY: number }).scrollY,
      );

      // A small, generous margin for the page's own bottom padding — never
      // enough to hide a real dead-space regression, which the escaping,
      // absolutely positioned sr-only merge table used to add on the order
      // of hundreds of px (four cards' worth of wrapped, multi-line caption
      // text, each one positioned with no relative ancestor to clip it).
      const MARGIN_PX = 64;
      expect(
        scrollHeight - cardBottomInDocument,
        `page scrollHeight (${scrollHeight}) extends ${(scrollHeight - cardBottomInDocument).toFixed(0)}px past the last visible card's own bottom edge (${cardBottomInDocument.toFixed(0)})`,
      ).toBeLessThanOrEqual(MARGIN_PX);
    });
  }
});
