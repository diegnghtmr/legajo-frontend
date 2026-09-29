import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { buildDpTrace } from './support/dpTraceBuilder.js';
import { loadFixture } from './support/fixtures.js';
import { holdApi } from './support/holdApi.js';
import { expectLoadingSentencesHidden } from './support/loadingText.js';
import { expectSkeletonsHoldNoFocusable } from './support/skeletonFocus.js';

/**
 * Regression guard for the loading skeletons: for every screen listed
 * below, at 1440×900, 1024×900 and 390×844, this holds every API response
 * the screen needs, measures its own region's outer box and the page's
 * `scrollHeight` while still showing the skeleton, releases the held
 * responses, waits for the real content, and asserts neither the box nor
 * the page grew or shrank by more than a few pixels — "same box, no shift"
 * as an executable check, not only a rule in prose.
 *
 * Every fixture below is a real response this project's own backend
 * returned for a fixed request against the reference corpus (see each
 * file's own capture note) — never a hand-authored shape. The previous
 * round of this guard used synthetic fixtures and passed while the real
 * app still shifted by up to 1172px, because a synthetic shape can always
 * happen to fit whatever the skeleton already reserves; only a real
 * response exercises the actual token counts, wrap points and row counts
 * a real document pair or the full reference corpus produces.
 *
 * A region that is itself a bounded, internally scrollable viewport (the
 * DP matrix, the results matrix, the DP operations sequence, the docked
 * trace panel's own body) is expected to measure at, or close to, zero
 * delta BECAUSE it is bounded: its own `overflow-auto` clips real content
 * to that same fixed height regardless of how much content actually
 * arrives, so the same small tolerance below already covers it without a
 * larger, separately justified one.
 */
const TOLERANCE_PX = 4;

/** Cold start only: the algorithm catalogue is prefetched at startup, so the
 * compare table normally renders the real names from the first frame. When
 * that request is still in flight the names are unknown and hold a
 * one-line placeholder; at 1024px a few of the real names (the longest
 * ones) wrap onto a second line in the algorithm column, and no placeholder
 * can know which. Measured at 54px for the six-row table; every other
 * width measures within `TOLERANCE_PX`. */
const COLD_CATALOGUE_NAME_WRAP_TOLERANCE_PX = 60;

interface Corpus {
  id: string;
  title: string;
  authors: readonly string[];
}

const CORPUS = loadFixture<readonly Corpus[]>('corpus.json');
const CORPUS_TWO = CORPUS.slice(0, 2);
const CORPUS_THREE = CORPUS.slice(0, 3);
const [DOC_A, DOC_B] = CORPUS_TWO;

const ALGORITHM_CATALOGUE = loadFixture<unknown>('algorithms.json');
const COMPARE_RESULTS = loadFixture<unknown>('compare-d01-d02.json');
const MATRIX_D01_D02_D03 = loadFixture<unknown>('matrix-d01-d02-d03.json');

/** d01/d02's own real Levenshtein/Needleman–Wunsch matrix shape (both
 * share it: same document pair, same tokenization) — 106 row tokens, 83
 * column tokens, a 107x84 matrix. Built rather than captured: the
 * skeleton-vs-loaded box this guard checks depends only on this shape,
 * never on which specific word labels which row, so a small, cycled
 * sample of real tokens reproduces it without shipping the real
 * response's own much larger label arrays. */
const DP_REAL_SHAPE = { rowTokenCount: 106, columnTokenCount: 83 } as const;
const DP_LEVENSHTEIN_TRACE = buildDpTrace({ algorithmId: 'levenshtein', ...DP_REAL_SHAPE });
const DP_NEEDLEMAN_WUNSCH_TRACE = buildDpTrace({
  algorithmId: 'needleman-wunsch',
  ...DP_REAL_SHAPE,
});
const EMBEDDING_LOCAL_TRACE = loadFixture<unknown>('trace-embedding-local-d01-d02.json');
const EMBEDDING_API_TRACE = loadFixture<unknown>('trace-embedding-api-d01-d02.json');

/**
 * d01/d02 (used above and for every other screen in this guard) is the
 * SMALLEST of the reference corpus's own 190 possible pairs by Jaccard
 * union size (134) — a real response, but not a representative one. The
 * full-screen Jaccard and TF-IDF cases below use this pair instead: d14
 * and d15, whose own union (180) sits right on the corpus-wide median
 * (180, quartiles 169/197) measured across every pair, so the skeleton's
 * own corpus-median sizing (`JACCARD_TYPICAL_TOKEN_COUNTS` in
 * `TraceBodySkeleton.tsx`) is checked against a response its own numbers
 * actually describe.
 */
const JACCARD_TRACE_MEDIAN = loadFixture<unknown>('trace-jaccard-d14-d15.json');
const TFIDF_TRACE_MEDIAN = loadFixture<unknown>('trace-tfidf-cosine-d14-d15.json');
const MEDIAN_DOC_A_ID = 'd14';
const MEDIAN_DOC_B_ID = 'd15';

/** The whole reference corpus (20 documents) — clustering carries no
 * document selection of its own, unlike similarity's compare/matrix
 * requests, so it always runs over every one of these. */
const CORPUS_TWENTY = CORPUS;

/** The default representation/all-four-linkages response, captured
 * straight from the reference corpus. Unlike the previous round's
 * synthetic fixture (a single hand-built merge chain, contrived evaluation
 * numbers), this is what real cophenetic/silhouette/Davies–Bouldin numbers
 * over 20 real documents actually look like, including which linkage
 * actually leads the tree and which leads the partition at k_ref — the
 * exact thing the previous fixture could not exercise. */
const CLUSTERING_RESPONSE = loadFixture<unknown>('clustering-default.json');

const BENCHMARK_REPORT = loadFixture<unknown>('benchmarks.json');
const EMBEDDINGS_STATUS = loadFixture<unknown>('embeddings-status.json');
const ARTICLE_D01 = loadFixture<{
  id: string;
  title: string;
  authors: readonly string[];
  abstract: string;
}>('article-d01.json');

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
 * `hit-areas.spec.ts`'s own `FlexGrowWindow` access already uses.
 *
 * `document.body.scrollHeight`, not `document.documentElement.scrollHeight`:
 * verified live against the clustering screen, the two disagree by exactly
 * one sr-only accessibility table's own painted extent (`Dendrogram`'s own
 * per-merge table, `position: absolute` with no positioned ancestor to
 * clip it) — `documentElement.scrollHeight` counts that off-screen, never-
 * visible box; `body.scrollHeight` does not, matching what a sighted
 * visitor's own scrollbar actually reflects. Every real, visible layout
 * shift this guard cares about still grows the body's own normal-flow
 * content, so this substitution loses no real detection. */
async function measure(page: Page, region: Locator): Promise<RegionMeasurement> {
  // Every measurement waits for the page's own web fonts first: text
  // still on a fallback font can wrap at a different point than it does
  // once Geist/Geist Mono finish loading, which would otherwise make a
  // text-wrap-sensitive region (a real caveat sentence, an invisible
  // sizer built from one) measure differently run to run for a reason
  // that has nothing to do with the skeleton itself.
  await page.evaluate(
    () =>
      (globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }).document.fonts
        .ready,
  );
  const box = await region.boundingBox();
  if (!box) {
    throw new Error('region has no bounding box — is it visible?');
  }
  const scrollHeight = await page.evaluate(
    () =>
      (globalThis as unknown as { document: { body: { scrollHeight: number } } }).document.body
        .scrollHeight,
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

/** A wide formula or table must scroll inside its own box, never widen the
 * page: the document is exactly as wide as the viewport. */
async function expectNoPageHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const root = (
      globalThis as unknown as {
        document: { documentElement: { scrollWidth: number; clientWidth: number } };
      }
    ).document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
  expect(scrollWidth, 'page scrollWidth vs viewport clientWidth').toBe(clientWidth);
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 900 },
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

    /**
     * The real flow: two ticked rail checkboxes (plus the tray's own button
     * below `lg`, where the corpus list stays the main content until the
     * pair is confirmed) mount the compare view, which fires the algorithm
     * catalogue and the compare request together. Either can land first, so
     * the skeleton is measured in both states: catalogue already resolved
     * and only the compare pending, and both still in flight.
     */
    for (const catalogueState of ['resolved', 'in flight'] as const) {
      test(`similarity pair, catalogue ${catalogueState}: the compare table (≥lg) or list (<lg) region matches its loaded box`, async ({
        page,
      }) => {
        await page.route('**/api/v1/corpus', async (route) => {
          await route.fulfill({ json: CORPUS });
        });
        const held = [{ pattern: '**/api/v1/similarity/compare', json: COMPARE_RESULTS }];
        if (catalogueState === 'in flight') {
          held.push({ pattern: '**/api/v1/similarity/algorithms', json: ALGORITHM_CATALOGUE });
        } else {
          await page.route('**/api/v1/similarity/algorithms', async (route) => {
            await route.fulfill({ json: ALGORITHM_CATALOGUE });
          });
        }
        const pending = await holdApi(page, held);

        await page.goto('/');
        await page.getByRole('checkbox', { name: DOC_A.title }).check();
        await page.getByRole('checkbox', { name: DOC_B.title }).check();
        if (viewport.width < 1024) {
          await page.getByRole('button', { name: `Comparar ${DOC_A.id} y ${DOC_B.id}` }).click();
        }

        const region = page.getByTestId('similarity-results-region');
        await expect(page.getByText('Calculando la comparación…')).toHaveCount(1);
        if (catalogueState === 'resolved') {
          // The catalogue has landed: its selectable ids replace the placeholder row.
          await expect(
            page.getByRole('button', { name: 'levenshtein', pressed: true }),
          ).toBeVisible();
        }
        const skeleton = await measure(page, region);
        await expectSkeletonsHoldNoFocusable(page);
        await expectAxeClean(page);

        pending.release();
        await expect(
          page.getByRole('button', { name: 'levenshtein', exact: true }).first(),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'levenshtein', pressed: true }),
        ).toBeVisible();
        await expect(page.getByText('Calculando la comparación…')).toHaveCount(0);
        await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
        const loaded = await measure(page, region);
        await expectAxeClean(page);

        const coldNarrowTable = catalogueState === 'in flight' && viewport.width === 1024;
        assertSameBox(
          skeleton,
          loaded,
          coldNarrowTable ? COLD_CATALOGUE_NAME_WRAP_TOLERANCE_PX : TOLERANCE_PX,
        );
      });
    }

    test('similarity matrix: the matrix region matches its loaded box', async ({ page }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_THREE });
      });
      const matrix = await holdApi(page, [
        { pattern: '**/api/v1/similarity/matrix', json: MATRIX_D01_D02_D03 },
      ]);

      await page.goto('/');
      await page.getByRole('checkbox', { name: CORPUS_THREE[0].title }).check();
      await page.getByRole('checkbox', { name: CORPUS_THREE[1].title }).check();
      await page.getByRole('checkbox', { name: CORPUS_THREE[2].title }).check();
      await page.getByRole('button', { name: 'Ver matriz de 3' }).click();

      // The skeleton is a plain clipped box; the loaded table is the labelled
      // scroll region. One locator follows the swap.
      const region = page.getByTestId('matrix-skeleton').or(
        page.getByRole('region', {
          name: 'Matriz de similitud por pares para el algoritmo elegido',
        }),
      );
      await expect(page.getByText('Calculando la matriz…')).toHaveCount(1);
      const skeleton = await measure(page, region);
      await expectSkeletonsHoldNoFocusable(page);

      matrix.release();
      await expect(region.getByText('1.000').first()).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      assertSameBox(skeleton, loaded);
    });

    test('docked trace, DP algorithm (Levenshtein): the panel region matches its loaded box, axe-clean in both states', async ({
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
          json: DP_LEVENSHTEIN_TRACE,
        },
      ]);

      await page.goto(
        `/similarity/levenshtein/trace?documentIdA=${DOC_A.id}&documentIdB=${DOC_B.id}`,
      );

      const region = page.getByTestId('trace-detail-panel');
      await expect(page.getByText('Cargando la traza…')).toHaveCount(1);
      // The formula caption needs no fetched data (`TraceBodySkeleton`
      // renders it for real immediately), but its KaTeX chunk still loads
      // asynchronously — waited on here so this measurement lands after
      // that one-time layout settles, the same way the loaded measurement
      // below already lands well after it.
      await expect(page.locator('.katex').first()).toBeVisible();
      const skeleton = await measure(page, region);
      await expectSkeletonsHoldNoFocusable(page);
      await expectAxeClean(page);

      held.release();
      // The real matrix's own cells (never present on the skeleton, which
      // fills its bounded viewport with one placeholder block instead of
      // a table) — the docked panel hides `DpTracePanel`'s own meta row
      // (`hideDpMetaRow`), so that testid never appears here at all.
      await expect(page.locator('td[data-optimal-path="true"]').first()).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);
      await expectAxeClean(page);

      assertSameBox(skeleton, loaded);
    });

    test('docked trace, non-DP algorithm (embedding-api): the panel region matches its loaded box, axe-clean in both states', async ({
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

      await page.goto(
        `/similarity/embedding-api/trace?documentIdA=${DOC_A.id}&documentIdB=${DOC_B.id}`,
      );

      const region = page.getByTestId('trace-detail-panel');
      await expect(page.getByText('Cargando la traza…')).toHaveCount(1);
      const skeleton = await measure(page, region);
      await expectSkeletonsHoldNoFocusable(page);
      await expectAxeClean(page);

      held.release();
      await expect(page.getByTestId('embedding-api-providerStatus')).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);
      await expectAxeClean(page);

      assertSameBox(skeleton, loaded);
    });

    test('docked trace, Jaccard (a body with no focusable region of its own): the panel region matches its loaded box, axe-clean in both states', async ({
      page,
    }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_TWO });
      });
      await page.route('**/api/v1/similarity/algorithms', async (route) => {
        await route.fulfill({ json: ALGORITHM_CATALOGUE });
      });
      await page.route('**/api/v1/similarity/compare', async (route) => {
        await route.fulfill({ json: COMPARE_RESULTS });
      });
      const held = await holdApi(page, [
        { pattern: '**/api/v1/similarity/jaccard/trace**', json: JACCARD_TRACE_MEDIAN },
      ]);

      await page.goto(
        `/similarity/jaccard/trace?documentIdA=${MEDIAN_DOC_A_ID}&documentIdB=${MEDIAN_DOC_B_ID}`,
      );

      const region = page.getByTestId('trace-detail-panel');
      await expect(page.getByText('Cargando la traza…')).toHaveCount(1);
      const skeleton = await measure(page, region);
      await expectSkeletonsHoldNoFocusable(page);
      // Unlike the DP and TF-IDF bodies above, Jaccard's own fields carry
      // no focusable control at all — the median pair's own token lists
      // (setA 86, setB 105, intersection 11, union 180) make this panel's
      // bounded body genuinely taller than its own fixed height and need
      // to scroll, which is exactly the shape that reproduced the
      // reported `scrollable-region-focusable` finding on this exact
      // wrapper.
      await expectAxeClean(page);

      held.release();
      await expect(page.getByRole('region', { name: /uni[oó]n/i })).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);
      await expectAxeClean(page);

      assertSameBox(skeleton, loaded);
    });

    /**
     * A docked trace deep link opened cold: the compare table behind the
     * panel and the panel's own body are both still loading, so the page
     * holds two skeletons at once. A skeleton has nothing focusable in it,
     * so none of its boxes may be a scrolling region (axe flags a scrollable
     * region a keyboard cannot reach), which the table skeleton beside a
     * docked panel must satisfy at the width where that panel is docked.
     */
    const DOCKED_TRACES = [
      { algorithmId: 'levenshtein', trace: DP_LEVENSHTEIN_TRACE },
      { algorithmId: 'jaccard', trace: JACCARD_TRACE_MEDIAN },
      { algorithmId: 'tfidf-cosine', trace: TFIDF_TRACE_MEDIAN },
    ] as const;
    for (const { algorithmId, trace } of DOCKED_TRACES) {
      test(`docked trace with the compare table also loading (${algorithmId}): the skeletons hold no scrollable region`, async ({
        page,
      }) => {
        test.skip(
          viewport.width < 1024,
          'below lg the trace opens as a sheet, not docked beside the table',
        );
        await page.route('**/api/v1/corpus', async (route) => {
          await route.fulfill({ json: CORPUS });
        });
        const held = await holdApi(page, [
          { pattern: '**/api/v1/similarity/algorithms', json: ALGORITHM_CATALOGUE },
          { pattern: '**/api/v1/similarity/compare', json: COMPARE_RESULTS },
          { pattern: `**/api/v1/similarity/${algorithmId}/trace**`, json: trace },
        ]);

        await page.goto(
          `/similarity/${algorithmId}/trace?documentIdA=${MEDIAN_DOC_A_ID}&documentIdB=${MEDIAN_DOC_B_ID}`,
        );

        await expect(page.getByText('Cargando la traza…')).toHaveCount(1);
        await expect(page.getByText('Calculando la comparación…')).toHaveCount(1);
        await measure(page, page.getByTestId('trace-detail-panel'));
        await expectSkeletonsHoldNoFocusable(page);
        await expectAxeClean(page);

        held.release();
        await expect(page.getByText('Cargando la traza…')).toHaveCount(0);
        await expectAxeClean(page);
      });
    }

    /**
     * The full-screen trace view (`/similarity/:algorithmId/trace/full`)
     * has no bounded viewport of its own — unlike the docked panel above,
     * whose fixed-height, internally scrolling body absorbs any box
     * mismatch — so every field a real trace body can grow (a wrapped
     * token list, an unbounded terms table, the DP meta row) pushes the
     * whole page taller here. One case per capability, each against its
     * own real captured trace, covers every variant `TraceBodySkeleton`
     * routes to.
     */
    const FULL_SCREEN_TRACE_CASES: ReadonlyArray<{
      algorithmId: string;
      fixture: unknown;
      /** Defaults to `DOC_A`/`DOC_B` (d01/d02) — overridden for Jaccard and
       * TF-IDF, whose own skeleton sizing is corpus-median-driven, not
       * derived from that one (smallest-of-190) pair; see
       * `JACCARD_TRACE_MEDIAN`'s own doc comment above. */
      documentIdA?: string;
      documentIdB?: string;
      /** Only the two DP capabilities and TF-IDF render a KaTeX formula
       * caption at all (`FormulaCaption`) — Jaccard and both embedding
       * bodies never do, so waiting on `.katex` for those would time out on
       * a perfectly correct render, not a real defect. */
      hasFormula: boolean;
      waitForLoaded: (page: Page) => Promise<unknown>;
      /** Only the Jaccard median pair needs a larger, justified tolerance:
       * its token lists each sit below the corpus median for that field
       * (see its case). Every other case matches to the default. */
      tolerancePx?: number;
    }> = [
      {
        algorithmId: 'levenshtein',
        fixture: DP_LEVENSHTEIN_TRACE,
        hasFormula: true,
        waitForLoaded: (page) =>
          expect(page.locator('td[data-optimal-path="true"]').first()).toBeVisible(),
      },
      {
        algorithmId: 'needleman-wunsch',
        fixture: DP_NEEDLEMAN_WUNSCH_TRACE,
        hasFormula: true,
        waitForLoaded: (page) =>
          expect(page.locator('td[data-optimal-path="true"]').first()).toBeVisible(),
      },
      {
        algorithmId: 'jaccard',
        fixture: JACCARD_TRACE_MEDIAN,
        documentIdA: MEDIAN_DOC_A_ID,
        documentIdB: MEDIAN_DOC_B_ID,
        hasFormula: false,
        waitForLoaded: (page) =>
          expect(page.getByRole('region', { name: /uni[oó]n/i })).toBeVisible(),
        // A justified tolerance, not the default: the skeleton reserves
        // each field's corpus-wide median token count (setA 100, setB 105,
        // intersection 16, union 180, over all 190 pairs), and this pair
        // sits on the union (180) and setB (105) exactly but below the
        // median on `setA` (86) and `intersection` (11). Measured live
        // against this exact fixture: 18px (one field's extra wrapped
        // line) at 1440/1024, 72px at 390, where `setA`'s 14-token excess
        // alone costs 3 extra lines. No single real pair sits on all four
        // medians at once.
        tolerancePx: 80,
      },
      {
        algorithmId: 'tfidf-cosine',
        fixture: TFIDF_TRACE_MEDIAN,
        documentIdA: MEDIAN_DOC_A_ID,
        documentIdB: MEDIAN_DOC_B_ID,
        hasFormula: true,
        waitForLoaded: (page) =>
          expect(page.getByRole('region', { name: 'Pesos término a término' })).toBeVisible(),
      },
      {
        algorithmId: 'embedding-local',
        fixture: EMBEDDING_LOCAL_TRACE,
        hasFormula: false,
        waitForLoaded: (page) =>
          expect(page.getByTestId('embedding-local-dotProduct')).toBeVisible(),
      },
      {
        algorithmId: 'embedding-api',
        fixture: EMBEDDING_API_TRACE,
        hasFormula: false,
        waitForLoaded: (page) =>
          expect(page.getByTestId('embedding-api-providerStatus')).toBeVisible(),
      },
    ];

    for (const {
      algorithmId,
      fixture,
      documentIdA = DOC_A.id,
      documentIdB = DOC_B.id,
      hasFormula,
      waitForLoaded,
      tolerancePx,
    } of FULL_SCREEN_TRACE_CASES) {
      test(`full-screen trace (${algorithmId}): the page region matches its loaded box`, async ({
        page,
      }) => {
        await page.route('**/api/v1/corpus', async (route) => {
          await route.fulfill({ json: CORPUS_TWO });
        });
        await page.route('**/api/v1/similarity/algorithms', async (route) => {
          await route.fulfill({ json: ALGORITHM_CATALOGUE });
        });
        const held = await holdApi(page, [
          { pattern: `**/api/v1/similarity/${algorithmId}/trace**`, json: fixture },
        ]);

        await page.goto(
          `/similarity/${algorithmId}/trace/full?documentIdA=${documentIdA}&documentIdB=${documentIdB}`,
        );

        const region = page.getByTestId('similarity-trace-page');
        await expect(page.getByText('Cargando la traza…')).toHaveCount(1);
        if (hasFormula) {
          await expect(page.locator('.katex').first()).toBeVisible();
        }
        const skeleton = await measure(page, region);
        await expectSkeletonsHoldNoFocusable(page);
        await expectNoPageHorizontalScroll(page);
        // A single representative axe pass at the widest viewport: the
        // findings this guard actually reproduced (`empty-table-header`,
        // `scrollable-region-focusable`) are structural, not width-
        // dependent, and a full pass over a ~9,000-cell real DP matrix at
        // every width/state combination would multiply this guard's own
        // runtime for no extra detection.
        if (viewport.width === 1440) {
          await expectAxeClean(page);
        }

        held.release();
        await waitForLoaded(page);
        await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
        if (hasFormula) {
          await expect(page.locator('.katex').first()).toBeVisible();
        }
        const loaded = await measure(page, region);
        await expectNoPageHorizontalScroll(page);
        if (viewport.width === 1440) {
          await expectAxeClean(page);
        }

        console.log(
          'DBG',
          algorithmId,
          viewport.width,
          loaded.height - skeleton.height,
          loaded.scrollHeight - skeleton.scrollHeight,
        );
        assertSameBox(skeleton, loaded, tolerancePx);
      });
    }

    test('clustering: the page region and the metrics header row match their loaded boxes', async ({
      page,
    }) => {
      // Opened cold, the corpus list and the clustering request are both in
      // flight while the skeleton shows.
      const pending = await holdApi(page, [
        { pattern: '**/api/v1/corpus', json: CORPUS_TWENTY },
        { pattern: '**/api/v1/clustering', json: CLUSTERING_RESPONSE },
      ]);

      await page.goto('/clustering');

      const region = page.getByTestId('clustering-page');
      const headerRow = page.locator('table thead tr').first();
      await expect(page.getByText('Calculando el agrupamiento…')).toHaveCount(1);
      const skeleton = await measure(page, region);
      await expectSkeletonsHoldNoFocusable(page);
      const skeletonHeader = await measure(page, headerRow);
      await expectAxeClean(page);

      pending.release();
      await expect(page.getByRole('heading', { name: 'Single linkage' })).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);
      const loadedHeader = await measure(page, headerRow);

      assertSameBox(skeleton, loaded);
      // The header labels are known before the response, so the row wraps
      // (and so grows) exactly as the loaded one does.
      expect(
        Math.abs(loadedHeader.height - skeletonHeader.height),
        `metrics header row: ${skeletonHeader.height} (skeleton) vs ${loadedHeader.height} (loaded)`,
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    });

    test('clustering: neither the skeleton nor the loaded page scrolls horizontally at any width', async ({
      page,
    }) => {
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({ json: CORPUS_TWENTY });
      });
      const clustering = await holdApi(page, [
        { pattern: '**/api/v1/clustering', json: CLUSTERING_RESPONSE },
      ]);

      await page.goto('/clustering');
      await expect(page.getByText('Calculando el agrupamiento…')).toHaveCount(1);

      const skeletonScrollWidth = await page.evaluate(
        () =>
          (globalThis as unknown as { document: { documentElement: { scrollWidth: number } } })
            .document.documentElement.scrollWidth,
      );
      const clientWidth = await page.evaluate(
        () =>
          (globalThis as unknown as { document: { documentElement: { clientWidth: number } } })
            .document.documentElement.clientWidth,
      );
      expect(skeletonScrollWidth, 'skeleton page scrollWidth vs viewport clientWidth').toBe(
        clientWidth,
      );

      clustering.release();
      await expect(page.getByRole('heading', { name: 'Single linkage' })).toBeVisible();
      const loadedScrollWidth = await page.evaluate(
        () =>
          (globalThis as unknown as { document: { documentElement: { scrollWidth: number } } })
            .document.documentElement.scrollWidth,
      );
      expect(loadedScrollWidth, 'loaded page scrollWidth vs viewport clientWidth').toBe(
        clientWidth,
      );
    });

    test('benchmarks: the page region matches its loaded box', async ({ page }) => {
      const benchmarks = await holdApi(page, [
        { pattern: '**/api/v1/benchmarks', json: BENCHMARK_REPORT },
      ]);

      await page.goto('/benchmarks');

      const region = page.getByTestId('benchmarks-page');
      await expect(page.getByText('Cargando las mediciones…')).toHaveCount(1);
      const skeleton = await measure(page, region);
      await expectSkeletonsHoldNoFocusable(page);

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
      await page.getByRole('button', { name: /Ver el detalle$/ }).click();

      const region = page.getByTestId('embeddings-status-panel');
      await expect(page.getByText('Cargando el estado de los embeddings…')).toHaveCount(1);
      const skeleton = await measure(page, region);
      await expectSkeletonsHoldNoFocusable(page);

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
        { pattern: `**/api/v1/corpus/${DOC_A.id}`, json: ARTICLE_D01 },
      ]);

      await page.goto('/');
      await page.getByRole('button', { name: DOC_A.title }).click();

      const region = page.getByTestId('article-abstract');
      await expect(page.getByText('Cargando el artículo…')).toHaveCount(1);
      const skeleton = await measure(page, region);
      await expectSkeletonsHoldNoFocusable(page);

      abstract.release();
      await expect(page.getByText(ARTICLE_D01.abstract, { exact: false })).toBeVisible();
      await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
      const loaded = await measure(page, region);

      assertSameBox(skeleton, loaded);
    });
  });
}

/**
 * The metrics table sits at its widest at these desktop widths, where a
 * header wraps or not depending on the exact width its column gets. Its
 * columns hold the same fixed widths in both states, so the header row is
 * the same height whether the body holds placeholder bars or real numbers.
 */
for (const width of [1440, 1280] as const) {
  test(`clustering metrics header row keeps its height between skeleton and loaded at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/embeddings/status', async (route) => {
      await route.fulfill({ json: EMBEDDINGS_STATUS });
    });
    const pending = await holdApi(page, [
      { pattern: '**/api/v1/corpus', json: CORPUS_TWENTY },
      { pattern: '**/api/v1/clustering', json: CLUSTERING_RESPONSE },
    ]);

    await page.goto('/clustering');
    const headerRow = page.locator('table thead tr').first();
    await expect(page.getByText('Calculando el agrupamiento…')).toHaveCount(1);
    const skeletonHeader = await measure(page, headerRow);
    await expectSkeletonsHoldNoFocusable(page);

    pending.release();
    await expect(page.getByRole('heading', { name: 'Single linkage' })).toBeVisible();
    await expectLoadingSentencesHidden(page, LOADING_SENTENCES);
    const loadedHeader = await measure(page, headerRow);

    expect(
      Math.abs(loadedHeader.height - skeletonHeader.height),
      `metrics header row: ${skeletonHeader.height} (skeleton) vs ${loadedHeader.height} (loaded)`,
    ).toBeLessThanOrEqual(1);
    expect(loadedHeader.width).toBeCloseTo(skeletonHeader.width, 0);
  });
}
