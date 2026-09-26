import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectNoTextOverlap } from './support/textOverlap.js';

/** The one DOM member this file's own browser-side callback needs, spelled
 * out locally rather than adding the `dom` lib (which this project's
 * Node-typed e2e tsconfig deliberately omits) — the same technique
 * `hit-areas.spec.ts`'s own `HitSizeWindow` already uses. */
interface FlexGrowComputedStyle {
  flexGrow: string;
}
interface FlexGrowWindow {
  getComputedStyle(element: unknown): FlexGrowComputedStyle;
}

/** The control bar group's own computed `flex-grow` — `0` unless something
 * stretches it to fill the row (the exact CSS property the old
 * `min-w-[260px] flex-1` regression set to `1` on the cut group's own
 * wrapper). */
async function computedFlexGrow(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    const win = (globalThis as unknown as { window: FlexGrowWindow }).window;
    return win.getComputedStyle(el).flexGrow;
  });
}

/**
 * Contract-shaped payloads (`GET /corpus`, `POST /clustering`) — no
 * live backend: `page.route` intercepts every request so this suite runs
 * fully offline. 6 documents -> k_ref =
 * min(4, 6-1) = 4, so every fixed cut k ∈ {2,3,4,5} is present.
 */
const CORPUS_SUMMARIES = Array.from({ length: 6 }, (_unused, index) => ({
  id: `doc-0${index + 1}`,
  title: `Article ${index + 1}`,
  authors: ['A. Author'],
}));

/** Same order as `CORPUS_SUMMARIES` (documentIds[i] is the document behind observation i). */
const DOCUMENT_IDS = CORPUS_SUMMARIES.map((document) => document.id);

function evaluation(cophenetic: number, silhouetteAtKRef: number, dbAtKRef: number | null) {
  return {
    cophenetic,
    meanSilhouette: { '2': 0.15, '3': 0.25, '4': silhouetteAtKRef, '5': 0.35 },
    daviesBouldin: { '2': 0.6, '3': 0.5, '4': dbAtKRef, '5': 0.4 },
  };
}

/**
 * Golden n = 6 linkage matrix (5 rows, `idx1 < idx2`,
 * the cluster created by row i gets id 6 + i, non-decreasing distances) —
 * same shape `dendrogramLayout.test.ts` and `ClusteringPage.test.tsx`
 * validate on their own, so every mocked linkage here has a real dendrogram
 * to draw instead of `rows: []` (which `Dendrogram` would now reject
 * as malformed).
 */
const GOLDEN_ROWS_N6 = [
  { idx1: 0, idx2: 1, mergeDistance: 0.1, size: 2 },
  { idx1: 2, idx2: 3, mergeDistance: 0.2, size: 2 },
  { idx1: 4, idx2: 5, mergeDistance: 0.3, size: 2 },
  { idx1: 6, idx2: 7, mergeDistance: 0.4, size: 4 },
  { idx1: 8, idx2: 9, mergeDistance: 0.5, size: 6 },
];

/**
 * `single` wins cophenetic alone (no tie); `complete` has the
 * highest silhouette at k_ref=4, so the two leaders differ and both the
 * "Árbol"/Tree and "Partición"/Partition eyebrows are exercised.
 */
const DEFAULT_CLUSTERING_RESPONSE = [
  {
    linkageId: 'single',
    linkageDisplayName: 'Single',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: DOCUMENT_IDS,
    evaluation: evaluation(0.95, 0.2, 0.5),
  },
  {
    linkageId: 'complete',
    linkageDisplayName: 'Complete',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [2, 3, 0, 1, 4, 5],
    documentIds: DOCUMENT_IDS,
    evaluation: evaluation(0.5, 0.9, 0.1),
  },
  {
    linkageId: 'average',
    linkageDisplayName: 'Average',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: DOCUMENT_IDS,
    evaluation: evaluation(0.4, 0.3, 0.2),
  },
  {
    linkageId: 'ward',
    linkageDisplayName: 'Ward',
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: DOCUMENT_IDS,
    evaluation: evaluation(0.3, 0.1, null),
  },
];

async function mockClusteringApi(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/clustering', async (route) => {
    await route.fulfill({ json: DEFAULT_CLUSTERING_RESPONSE });
  });
}

test.describe('clustering screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockClusteringApi(page);
  });

  test('the default request (tfidf-cosine, all four linkages) shows the metrics comparison table and every dendrogram, with the cophenetic leader marked', async ({
    page,
  }) => {
    const requestBodies: unknown[] = [];
    await page.route('**/api/v1/clustering', async (route) => {
      requestBodies.push(route.request().postDataJSON());
      await route.fulfill({ json: DEFAULT_CLUSTERING_RESPONSE });
    });

    await page.goto('/clustering');

    await expect(page.getByRole('heading', { name: 'Agrupamiento jerárquico' })).toBeVisible();

    for (const { linkageDisplayName } of DEFAULT_CLUSTERING_RESPONSE) {
      await expect(page.getByRole('heading', { name: linkageDisplayName })).toBeVisible();
    }

    // The cophenetic leader (single) is marked "Árbol"; the differing
    // silhouette-at-k_ref leader (complete) is marked "Partición".
    await expect(page.getByText('Árbol')).toBeVisible();
    await expect(page.getByText('Partición')).toBeVisible();

    // Ward's k_ref Davies-Bouldin is null.
    await expect(page.getByText('no definido').first()).toBeVisible();

    // Sample-size caveat states n = |corpus| (6 documents mocked above).
    await expect(page.getByText(/n = 6/)).toBeVisible();

    expect(requestBodies).toEqual([
      { representation: 'tfidf-cosine', linkages: ['single', 'complete', 'average', 'ward'] },
    ]);
  });

  test('switching representation re-requests the clustering endpoint', async ({ page }) => {
    const requestBodies: unknown[] = [];
    await page.route('**/api/v1/clustering', async (route) => {
      requestBodies.push(route.request().postDataJSON());
      await route.fulfill({ json: DEFAULT_CLUSTERING_RESPONSE });
    });

    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    const group = page.getByRole('radiogroup', { name: 'Representación' });
    await group.getByRole('radio', { name: 'embedding-api' }).click();

    await expect
      .poll(() => requestBodies.at(-1))
      .toEqual({
        representation: 'embedding-api',
        linkages: ['single', 'complete', 'average', 'ward'],
      });
  });

  test('shows four dendrograms and applies a free cut with cluster labels and a cut line on the chosen linkage', async ({
    page,
  }) => {
    await page.route('**/api/v1/clustering/cut', async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        representation: 'tfidf-cosine',
        linkage: 'complete',
        k: 3,
      });
      await route.fulfill({
        json: { labels: [0, 0, 1, 1, 2, 2], k: 3, documentIds: DOCUMENT_IDS },
      });
    });

    await page.goto('/clustering');

    for (const { linkageDisplayName } of DEFAULT_CLUSTERING_RESPONSE) {
      await expect(
        page.getByRole('img', { name: `Dendrograma de ${linkageDisplayName}` }),
      ).toBeVisible();
    }

    const cutGroup = page.getByRole('radiogroup', { name: 'Enlace a cortar' });
    await cutGroup.getByRole('radio', { name: 'Complete' }).click();
    await page.getByLabel('Número de clústeres k (entre 2 y 5)').fill('3');
    await page.getByRole('button', { name: 'Aplicar corte' }).click();

    const completeDendrogram = page.getByTestId('linkage-dendrogram-complete');
    // An SVG `<line>` has a zero-area bounding box in Chromium's own
    // visibility geometry, so Playwright's `toBeVisible()` (which needs a
    // hit-testable point) reports it as hidden even though it renders; a DOM
    // presence check is the correct assertion here, same as the component
    // unit test's own `querySelectorAll` presence check.
    await expect(completeDendrogram.getByTestId('dendrogram-cut-line')).toBeAttached();
    // labels = [0, 0, 1, 1, 2, 2] over 6 leaves -> two leaves per cluster.
    // A bare, compact number, not the full "Clúster N" word (see
    // `Dendrogram.tsx`'s own overlap-avoidance comment).
    await expect(
      completeDendrogram.getByTestId('cluster-marker').filter({ hasText: /^0$/ }),
    ).toHaveCount(2);
    await expect(
      completeDendrogram.getByTestId('cluster-marker').filter({ hasText: /^1$/ }),
    ).toHaveCount(2);
    await expect(
      completeDendrogram.getByTestId('cluster-marker').filter({ hasText: /^2$/ }),
    ).toHaveCount(2);

    // No cut line leaks onto a linkage that was not cut.
    await expect(
      page.getByTestId('linkage-dendrogram-single').getByTestId('dendrogram-cut-line'),
    ).toHaveCount(0);

    // No dendrogram's own leaf/cluster labels overlap each other, with the
    // cut applied, at the default width.
    for (const linkageId of ['single', 'complete', 'average', 'ward']) {
      await expectNoTextOverlap(page.getByTestId(`linkage-dendrogram-${linkageId}`));
    }

    // The per-linkage sr-only merge-order table (one per dendrogram, now
    // with cut cluster markers rendered too) must never widen the page's
    // own scrollable area at a narrow width — `table-fixed` is what keeps it
    // collapsed (see `Dendrogram.tsx`).
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();
    // A string body (not an arrow function) so this evaluates in the
    // browser without pulling the `dom` lib into this project's Node-typed
    // e2e tsconfig (`tsconfig.node.json`).
    const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
    expect(scrollWidth).toBeLessThanOrEqual(390);

    // Same check, with the cut still applied, at 390px.
    for (const linkageId of ['single', 'complete', 'average', 'ward']) {
      await expectNoTextOverlap(page.getByTestId(`linkage-dendrogram-${linkageId}`));
    }
  });

  test('at 1440px the control bar sits above a 2x2 dendrogram grid; at 390px the grid stacks into one column with no page-level horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/clustering');

    const controlBarGroup = page.getByRole('radiogroup', { name: 'Representación' });
    await expect(controlBarGroup).toBeVisible();
    const controlBarBox = await controlBarGroup.boundingBox();
    expect(controlBarBox).not.toBeNull();

    const cardLocators = [
      page.getByTestId('linkage-dendrogram-single'),
      page.getByTestId('linkage-dendrogram-complete'),
      page.getByTestId('linkage-dendrogram-average'),
      page.getByTestId('linkage-dendrogram-ward'),
    ];
    const wideBoxes = [];
    for (const card of cardLocators) {
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      wideBoxes.push(box!);
    }

    // The control bar sits above every dendrogram card.
    for (const box of wideBoxes) {
      expect(controlBarBox!.y).toBeLessThan(box.y);
    }

    // 2x2: the first two cards share one row (same y, single left of
    // complete); the last two share a lower row (same y, average left of
    // ward).
    expect(Math.abs(wideBoxes[0].y - wideBoxes[1].y)).toBeLessThan(5);
    expect(wideBoxes[0].x).toBeLessThan(wideBoxes[1].x);
    expect(Math.abs(wideBoxes[2].y - wideBoxes[3].y)).toBeLessThan(5);
    expect(wideBoxes[2].x).toBeLessThan(wideBoxes[3].x);
    expect(wideBoxes[2].y).toBeGreaterThan(wideBoxes[0].y);

    // No dendrogram's own leaf labels overlap each other, without a cut, at
    // 1440px.
    for (const card of cardLocators) {
      await expectNoTextOverlap(card);
    }

    await page.setViewportSize({ width: 390, height: 844 });

    // One column: every card shares (roughly) the same x, and each sits
    // below the previous one. Each card's own `ResizeObserver` settles
    // asynchronously after the viewport resize, so poll until the grid
    // has actually re-flowed instead of reading the boxes exactly once.
    await expect
      .poll(
        async () => {
          const boxes = await Promise.all(cardLocators.map((card) => card.boundingBox()));
          if (boxes.some((box) => box === null)) {
            return null;
          }
          const nonNullBoxes = boxes as NonNullable<(typeof boxes)[number]>[];
          return nonNullBoxes.every(
            (box, index) =>
              index === 0 ||
              (Math.abs(box.x - nonNullBoxes[0]!.x) < 5 && box.y > nonNullBoxes[index - 1]!.y),
          );
        },
        { message: 'dendrogram cards should stack into one narrow column at 390px' },
      )
      .toBe(true);

    await expect
      .poll(async () => page.evaluate<number>('document.documentElement.scrollWidth'), {
        message: 'the page should never scroll horizontally at 390px',
      })
      .toBeLessThanOrEqual(390);

    // Same check, without a cut, once stacked into one column at 390px.
    for (const card of cardLocators) {
      await expectNoTextOverlap(card);
    }
  });

  for (const width of [1440, 1280, 1024, 768, 390]) {
    test(`at ${width}px, the control bar's three groups never stretch and leave no dead block`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/clustering');
      await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

      const representationGroup = page.getByRole('radiogroup', { name: 'Representación' });
      const linkageGroup = page.getByRole('group', { name: 'Selección de enlaces' });
      // The cut group's own outer box (the linkage radiogroup it applies
      // to, the k field, and the submit button, whichever wrap the same
      // row) — located by its own submit button's `<form>` ancestor, since
      // the group itself has no single accessible role of its own.
      const cutForm = page.locator('form', {
        has: page.getByRole('button', { name: 'Aplicar corte' }),
      });

      // Never stretched to fill the remaining row width: each group's own
      // computed `flex-grow` stays 0 — the exact CSS property the old
      // `min-w-[260px] flex-1` regression set to 1 on the cut group's own
      // wrapper. Read via a plain string body: this project's own `e2e/**`
      // tsconfig is Node-typed, with no DOM lib for a typed callback.
      for (const group of [representationGroup, linkageGroup, cutForm]) {
        expect(await computedFlexGrow(group)).toBe('0');
      }

      const representationBox = await representationGroup.boundingBox();
      const linkageBox = await linkageGroup.boundingBox();
      const cutBox = await cutForm.boundingBox();
      expect(representationBox).not.toBeNull();
      expect(linkageBox).not.toBeNull();
      expect(cutBox).not.toBeNull();

      // While the three groups still share one row (their own top edges
      // agree, `items-start`), no group towers over the shortest one: the
      // old stacked cut group measured ~177px against the other two
      // groups' ~36px. Once the row has actually wrapped (a shorter width),
      // the groups' own top edges necessarily differ — that is the
      // "wraps cleanly" behavior itself, not a dead block, so this height
      // comparison only applies to the shared-row case.
      const sameRow =
        Math.abs(representationBox!.y - cutBox!.y) < 5 && Math.abs(linkageBox!.y - cutBox!.y) < 5;
      if (sameRow) {
        const heights = [representationBox!.height, linkageBox!.height, cutBox!.height];
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(50);
      }

      // Never a horizontal scroll, wrapped or not.
      const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
      expect(scrollWidth).toBeLessThanOrEqual(width);
    });
  }

  test('deselecting every linkage shows the reason and no linkage panels', async ({ page }) => {
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    for (const id of ['single', 'complete', 'average', 'ward']) {
      await page.getByRole('button', { name: id, exact: true }).click();
    }

    await expect(page.getByText('Selecciona al menos un enlace para agrupar.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Single' })).toHaveCount(0);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the clustering screen', async ({
    page,
  }) => {
    await page.goto('/clustering');

    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
