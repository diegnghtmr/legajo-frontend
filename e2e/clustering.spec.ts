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
    await expect(
      page.getByTestId('metrics-row-single').getByText('Árbol', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId('metrics-row-complete').getByText('Partición', { exact: true }),
    ).toBeVisible();

    // Ward's k_ref Davies-Bouldin is null.
    await expect(page.getByText('no definido').first()).toBeVisible();

    // Sample-size caveat states n = |corpus| (6 documents mocked above).
    await expect(page.getByText(/Tamaño muestral del corpus cargado: n = 6/)).toBeVisible();

    expect(requestBodies).toEqual([
      { representation: 'tfidf-cosine', linkages: ['single', 'complete', 'average', 'ward'] },
    ]);
  });

  test('starts the free cut on average at the reference k with no cut applied', async ({
    page,
  }) => {
    let cutRequests = 0;
    await page.route('**/api/v1/clustering/cut', async (route) => {
      cutRequests += 1;
      await route.abort();
    });
    await page.setViewportSize({ width: 1467, height: 900 });

    await page.goto('/clustering');

    const cutGroup = page.getByRole('radiogroup', { name: 'Enlace a cortar' });
    await expect(cutGroup.getByRole('radio', { name: 'Average' })).toBeChecked();
    await expect(page.getByLabel('k: 2 a 5 (ref. 4)')).toHaveValue('4');
    await expect(page.getByTestId('cut-status')).toContainText('Sin corte aplicado');
    expect(cutRequests).toBe(0);

    await page.getByRole('region', { name: 'Parámetros del agrupamiento' }).screenshot({
      path: 'test-results/cluster-banner-v2/panel-1467.png',
    });
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
    await page.getByLabel('k: 2 a 5 (ref. 4)').fill('3');
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
    // Shown one-based, as people count clusters: 1, 2 and 3.
    for (const number of [1, 2, 3]) {
      await expect(
        completeDendrogram
          .getByTestId('cluster-marker')
          .filter({ hasText: new RegExp(`^${number}$`) }),
      ).toHaveCount(2);
    }

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
    test(`at ${width}px, the parameter panel's two columns start at the same top edge from 1024px and never scroll the page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/clustering');
      await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

      // A column is the header row's grandparent: heading, its baseline
      // row, the header row, the column itself.
      const column = (title: string) =>
        page.getByRole('heading', { name: title, level: 3 }).locator('xpath=../../..');
      const columns = [column('Representación'), column('Enlaces')];

      // Columns take their width from the grid track, never from flex growth.
      for (const item of columns) {
        expect(await computedFlexGrow(item)).toBe('0');
      }

      const [representationBox, linkageBox] = await Promise.all(
        columns.map((item) => item.boundingBox()),
      );
      expect(representationBox).not.toBeNull();
      expect(linkageBox).not.toBeNull();

      // While the columns share one row they start at the same top edge.
      if (width >= 1024) {
        expect(Math.abs(representationBox!.y - linkageBox!.y)).toBeLessThan(5);
      } else {
        expect(linkageBox!.y).toBeGreaterThan(representationBox!.y + representationBox!.height - 1);
      }

      // Never a horizontal scroll, wrapped or not.
      const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
      expect(scrollWidth).toBeLessThanOrEqual(width);
    });
  }

  test('an invalid k shows its range error under the field, wrapped inside the column, with Aplicar corte disabled and still on the field row', async ({
    page,
  }) => {
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    const field = page.getByLabel('k: 2 a 5 (ref. 4)');
    const submitButton = page.getByRole('button', { name: 'Aplicar corte' });
    const cutColumn = page
      .getByRole('heading', { name: 'Corte libre', level: 3 })
      .locator('xpath=../../..');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(submitButton).toBeEnabled();

    await field.fill('1');

    // The only alert present: the k error, as text under the field.
    const error = page.getByRole('alert');
    await expect(error).toHaveText(/k debe ser un entero/);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(submitButton).toBeDisabled();

    const fieldBox = await field.boundingBox();
    const errorBox = await error.boundingBox();
    const buttonBox = await submitButton.boundingBox();
    const columnBoxBefore = await cutColumn.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(errorBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(columnBoxBefore).not.toBeNull();
    expect(errorBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height - 1);
    // The button stays on the stepper's own row, not pushed below the error.
    expect(buttonBox!.y).toBeLessThan(errorBox!.y);

    // Fault injection: no real translation is this long today, but a future
    // or English string could be. A much longer message wraps onto more
    // lines inside the column instead of widening it.
    await error.evaluate((el) => {
      el.textContent =
        'k debe ser un número entero comprendido estrictamente entre 2 y 5, ambos inclusive, para que el corte sea válido en este corpus cargado actualmente.';
    });
    const columnBoxAfter = await cutColumn.boundingBox();
    expect(columnBoxAfter).not.toBeNull();
    expect(columnBoxAfter!.width).toBeCloseTo(columnBoxBefore!.width, 0);
    expect((await submitButton.boundingBox())!.x).toBeCloseTo(buttonBox!.x, 0);
  });

  test('each dendrogram has a "Distancia" axis, a dotted preview of the k being edited, and hover tooltips', async ({
    page,
  }) => {
    await page.goto('/clustering');
    const dendrogram = page.getByTestId('linkage-dendrogram-average');
    await expect(dendrogram.getByRole('img')).toBeVisible();

    await expect(dendrogram.locator('[data-axis-title]')).toHaveText('Distancia');
    expect(await dendrogram.locator('[data-axis-tick]').count()).toBeGreaterThanOrEqual(3);

    // The default k (4) is previewed on the linkage to cut (average), before any cut.
    await expect(dendrogram.getByTestId('dendrogram-preview-label')).toHaveText('k = 4');
    await expect(
      page.getByTestId('linkage-dendrogram-complete').getByTestId('dendrogram-preview-line'),
    ).toHaveCount(0);

    await dendrogram.locator('[data-leaf-id="0"]').hover();
    const leafTip = page.getByRole('tooltip');
    await expect(leafTip).toContainText('doc-01');
    await expect(leafTip).toContainText('Article 1');

    await dendrogram.locator('[data-merge-hit="6"]').hover({ force: true });
    await expect(page.getByRole('tooltip')).toContainText('1 / 5');
    await expect(page.getByRole('tooltip')).toContainText('0.1000');
  });

  test('"Ver en k" re-reads the silhouette and Davies–Bouldin columns while the leaders stay at k_ref', async ({
    page,
  }) => {
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    const selector = page.getByRole('radiogroup', { name: 'Ver en k' });
    await expect(selector.getByRole('radio', { name: '4 (ref)' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('columnheader', { name: 'Silueta media (k = 4) ↑' })).toBeVisible();

    await selector.getByRole('radio', { name: '2' }).click();

    await expect(page.getByRole('columnheader', { name: 'Silueta media (k = 2) ↑' })).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Davies–Bouldin (k = 2) ↓' }),
    ).toBeVisible();
    await expect(
      page.getByTestId('metrics-row-single').getByText('Árbol', { exact: true }),
    ).toBeVisible();
    // Every k's value stays available as text, whatever k is viewed.
    await expect(page.getByTestId('metrics-row-single')).toContainText('Valores por k: k = 2:');
  });

  test('the summary bar pins under the top bar once the parameter panel scrolls away, and "Editar" returns to the panel', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    const summary = page.getByRole('region', { name: 'Resumen de parámetros' });
    // In view, the bar is aria-hidden: not a region at all.
    await expect(summary).toHaveCount(0);

    await page.evaluate('window.scrollTo(0, 900)');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('tfidf-cosine');
    const summaryBox = await summary.boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(Math.abs(summaryBox!.y - 56)).toBeLessThan(2);
    // It overlays the content: it reserves no space in the page flow.
    expect(await page.evaluate<number>('document.documentElement.scrollHeight')).toBeGreaterThan(
      900,
    );

    await summary.getByRole('button', { name: 'Editar' }).click();
    const firstControl = page
      .getByRole('radiogroup', { name: 'Representación' })
      .getByRole('radio', {
        name: 'tfidf-cosine',
      });
    await expect(firstControl).toBeFocused();
    await expect(firstControl).toBeInViewport();
    await expect(summary).toHaveCount(0);
  });

  test('at 390px the summary bar stays on one line with a cut applied, collapsing the linkages to a count', async ({
    page,
  }) => {
    await page.route('**/api/v1/clustering/cut', async (route) => {
      await route.fulfill({
        json: { labels: [0, 0, 1, 1, 2, 2], k: 3, documentIds: DOCUMENT_IDS },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();
    await page
      .getByRole('radiogroup', { name: 'Enlace a cortar' })
      .getByRole('radio', { name: 'Complete' })
      .click();
    await page.getByLabel('k: 2 a 5 (ref. 4)').fill('3');
    await page.getByRole('button', { name: 'Aplicar corte' }).click();
    await expect(
      page.getByTestId('linkage-dendrogram-complete').getByTestId('dendrogram-cut-line'),
    ).toBeAttached();

    await page.evaluate('window.scrollTo(0, 1400)');
    const summary = page.getByRole('region', { name: 'Resumen de parámetros' });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('+3');

    const box = await summary.boundingBox();
    expect(box).not.toBeNull();
    // One line: the row's own padding plus the 28px button, never a second row.
    expect(box!.height).toBeLessThan(52);
    const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });

  test.describe('parameter panel layout', () => {
    interface Box {
      x: number;
      y: number;
      width: number;
      height: number;
    }
    interface PanelStyles {
      columnBorders: { left: number; top: number }[];
      bandBackground: string;
      bandBorderTop: number;
      sunkenToken: string;
    }

    async function box(locator: Locator): Promise<Box> {
      const found = await locator.boundingBox();
      expect(found).not.toBeNull();
      return found!;
    }

    /** Computed styles read in the browser, so the assertions do not depend on class names. */
    async function readStyles(page: Page): Promise<PanelStyles> {
      const panel = page.getByRole('region', { name: 'Parámetros del agrupamiento' });
      await expect(panel.getByTestId('params-cut-band')).toBeVisible();
      return panel.evaluate((section): PanelStyles => {
        const env = globalThis as unknown as {
          document: {
            body: { appendChild(node: unknown): void };
            createElement(tag: string): { className: string; remove(): void };
          };
          getComputedStyle(element: unknown): {
            backgroundColor: string;
            borderLeftWidth: string;
            borderTopWidth: string;
          };
        };
        const columns = section.querySelector('[data-testid="params-columns"]')!;
        const band = section.querySelector('[data-testid="params-cut-band"]')!;
        const probe = env.document.createElement('div');
        probe.className = 'bg-paper-sunken';
        env.document.body.appendChild(probe);
        const sunkenToken = env.getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          columnBorders: Array.from(columns.children).map((column) => {
            const style = env.getComputedStyle(column);
            return {
              left: parseFloat(style.borderLeftWidth),
              top: parseFloat(style.borderTopWidth),
            };
          }),
          bandBackground: env.getComputedStyle(band).backgroundColor,
          bandBorderTop: parseFloat(env.getComputedStyle(band).borderTopWidth),
          sunkenToken,
        };
      });
    }

    const toggles = (page: Page) =>
      page.getByRole('group', { name: 'Selección de enlaces' }).getByRole('button');

    test('at 1440px two equal columns share a 1px rule over four equal linkage boxes and a full-width sunken cut band', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/clustering');
      const styles = await readStyles(page);
      const panel = page.getByRole('region', { name: 'Parámetros del agrupamiento' });

      const columns = ['Representación', 'Enlaces'].map((title) =>
        page.getByRole('heading', { name: title, level: 3 }).locator('xpath=../../..'),
      );
      const [first, second] = await Promise.all(columns.map(box));
      expect(Math.abs(second!.width - first!.width)).toBeLessThanOrEqual(1);
      expect(styles.columnBorders).toEqual([
        { left: 0, top: 0 },
        { left: 1, top: 0 },
      ]);

      // The representation track spans its column; the options keep their
      // own width, packed from the left edge.
      const track = page.getByRole('radiogroup', { name: 'Representación' });
      const trackBox = await box(track);
      const optionBoxes = await Promise.all(
        [0, 1, 2].map((index) => box(track.getByRole('radio').nth(index))),
      );
      expect(Math.abs(trackBox.width - (first!.width - 40))).toBeLessThanOrEqual(2);
      expect(optionBoxes[0]!.x - trackBox.x).toBeLessThanOrEqual(6);
      const optionsEnd = optionBoxes[2]!.x + optionBoxes[2]!.width;
      expect(optionsEnd).toBeLessThan(trackBox.x + trackBox.width - 100);
      const spans = await track
        .getByRole('radio')
        .evaluateAll((radios) =>
          radios.map(
            (radio) =>
              radio.scrollWidth - (radio as unknown as { clientWidth: number }).clientWidth,
          ),
        );
      expect(spans).toEqual([0, 0, 0]);

      // Four equal boxes in one row, 8px apart, 36px tall.
      const boxes = await Promise.all([0, 1, 2, 3].map((index) => box(toggles(page).nth(index))));
      for (const [index, item] of boxes.entries()) {
        expect(Math.abs(item.y - boxes[0]!.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(item.width - boxes[0]!.width)).toBeLessThanOrEqual(1);
        expect(item.height).toBeCloseTo(36, 0);
        if (index > 0) {
          const previous = boxes[index - 1]!;
          expect(item.x - (previous.x + previous.width)).toBeCloseTo(8, 0);
        }
      }
      await expect(toggles(page)).toHaveCount(4);

      // The band spans the card under the columns, on the sunken surface.
      const panelBox = await box(panel);
      const bandBox = await box(page.getByTestId('params-cut-band'));
      expect(Math.abs(bandBox.width - panelBox.width)).toBeLessThanOrEqual(2);
      expect(bandBox.y).toBeGreaterThanOrEqual(first!.y + first!.height - 1);
      expect(styles.bandBackground).toBe(styles.sunkenToken);
      expect(styles.bandBorderTop).toBe(1);

      // The apply button ends the band's row; the status sits under it, right-aligned.
      const applyBox = await box(page.getByRole('button', { name: 'Aplicar corte' }));
      const statusBox = await box(page.getByTestId('cut-status'));
      expect(bandBox.x + bandBox.width - (applyBox.x + applyBox.width)).toBeLessThanOrEqual(24);
      expect(statusBox.y).toBeGreaterThanOrEqual(applyBox.y + applyBox.height - 1);
      expect(
        Math.abs(statusBox.x + statusBox.width - (applyBox.x + applyBox.width)),
      ).toBeLessThanOrEqual(2);

      // The corpus size and the reference cut come from the loaded response.
      await expect(
        page.getByRole('heading', { name: 'Representación', level: 3 }).locator('xpath=../..'),
      ).toContainText('n = 6');
      await expect(page.getByLabel('k: 2 a 5 (ref. 4)')).toHaveValue('4');
      await expect(page.getByTestId('params-status-footer')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Todos' })).toHaveCount(0);

      await panel.screenshot({ path: 'test-results/cluster-banner-v2/panel-1440.png' });
    });

    test('at 390px the representation options stack one per row, each on a single line inside the track', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/clustering');
      const group = page.getByRole('radiogroup', { name: 'Representación' });
      await expect(group).toBeVisible();

      const radios = group.getByRole('radio');
      await expect(radios).toHaveCount(3);
      const groupBox = (await group.boundingBox())!;
      const boxes = await Promise.all(
        [0, 1, 2].map(async (index) => (await radios.nth(index).boundingBox())!),
      );
      for (const [index, item] of boxes.entries()) {
        // One line of 13px text plus padding stays well under two line boxes.
        expect(item.height).toBeLessThanOrEqual(46);
        expect(item.x).toBeGreaterThanOrEqual(groupBox.x);
        expect(item.x + item.width).toBeLessThanOrEqual(groupBox.x + groupBox.width + 1);
        if (index > 0) {
          expect(item.y).toBeGreaterThan(boxes[index - 1]!.y);
          expect(Math.abs(item.x - boxes[0]!.x)).toBeLessThan(2);
        }
      }
      const overflow = await group.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    for (const width of [1024, 768, 390]) {
      test(`at ${width}px the panel wraps as specified and the page does not scroll sideways`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/clustering');
        const styles = await readStyles(page);
        const panel = page.getByRole('region', { name: 'Parámetros del agrupamiento' });

        const sideBySide = width >= 1024;
        expect(styles.columnBorders).toEqual(
          sideBySide
            ? [
                { left: 0, top: 0 },
                { left: 1, top: 0 },
              ]
            : [
                { left: 0, top: 0 },
                { left: 0, top: 1 },
              ],
        );
        expect(styles.bandBackground).toBe(styles.sunkenToken);

        // Four linkage boxes in one row from 640px; two columns below.
        const boxes = await Promise.all([0, 1, 2, 3].map((index) => box(toggles(page).nth(index))));
        if (width >= 640) {
          expect(new Set(boxes.map((item) => Math.round(item.y))).size).toBe(1);
        } else {
          expect(Math.abs(boxes[1]!.y - boxes[0]!.y)).toBeLessThanOrEqual(1);
          expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height - 1);
          expect(Math.abs(boxes[2]!.x - boxes[0]!.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(boxes[3]!.x - boxes[1]!.x)).toBeLessThanOrEqual(1);
        }

        // Every id shows in full, never cut with an ellipsis.
        const clipped = await toggles(page).evaluateAll((buttons) =>
          buttons.map((button) => {
            const label = (
              button as unknown as {
                firstElementChild: { scrollWidth: number; clientWidth: number };
              }
            ).firstElementChild;
            return label.scrollWidth > label.clientWidth;
          }),
        );
        expect(clipped).toEqual([false, false, false, false]);

        // Nothing spills out of the card, and the page never scrolls sideways.
        const panelBox = await box(panel);
        for (const control of [
          page.getByRole('button', { name: 'Aplicar corte' }),
          page.getByLabel('k: 2 a 5 (ref. 4)'),
          page.getByRole('radiogroup', { name: 'Enlace a cortar' }),
        ]) {
          const controlBox = await box(control);
          expect(controlBox.x).toBeGreaterThanOrEqual(panelBox.x - 1);
          expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(
            panelBox.x + panelBox.width + 1,
          );
        }
        if (!sideBySide) {
          // The action and its status take their own line under Enlace and k.
          const applyBox = await box(page.getByRole('button', { name: 'Aplicar corte' }));
          const kBox = await box(page.getByLabel('k: 2 a 5 (ref. 4)'));
          expect(applyBox.y).toBeGreaterThan(kBox.y + kBox.height - 1);
        }
        const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
        expect(scrollWidth).toBeLessThanOrEqual(width);

        await panel.screenshot({ path: `test-results/cluster-banner-v2/panel-${width}.png` });
      });
    }
  });

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

  /**
   * The reference corpus size (20 leaves): a valid n=20 linkage matrix built
   * as a chain (merge leaf 0 with leaf 1, then fold in each remaining leaf
   * one at a time) — every id is consumed exactly once, the same real
   * invariant `DEFAULT_CLUSTERING_RESPONSE`'s own n=6 matrix satisfies, just
   * generated instead of hand-written for 19 rows. The same rows/leafOrder
   * are reused across all four linkages: this test is about the chart's own
   * fit inside its card, not about the four linkages differing.
   */
  function goldenRowsAndOrderForLeafCount(leafCount: number) {
    const rows = [{ idx1: 0, idx2: 1, mergeDistance: 1, size: 2 }];
    for (let k = 1; k <= leafCount - 2; k += 1) {
      // idx1 (the next leaf) is always the SMALLER id here, and idx2 (the
      // growing cluster from the previous row) the larger one — idx1 must
      // be strictly less than idx2 (`assertValidRows`).
      rows.push({ idx1: k + 1, idx2: leafCount + k - 1, mergeDistance: k + 1, size: k + 2 });
    }
    return { rows, leafOrder: Array.from({ length: leafCount }, (_unused, index) => index) };
  }

  test.describe('a 20-leaf dendrogram (the reference corpus size)', () => {
    test.beforeEach(async ({ page }) => {
      const { rows, leafOrder } = goldenRowsAndOrderForLeafCount(20);
      const documentIds = Array.from({ length: 20 }, (_unused, index) => `doc-${index + 1}`);
      const response = ['single', 'complete', 'average', 'ward'].map((linkageId) => ({
        linkageId,
        linkageDisplayName: linkageId[0]!.toUpperCase() + linkageId.slice(1),
        rows,
        leafOrder,
        documentIds,
        evaluation: evaluation(0.5, 0.2, 0.3),
      }));
      await page.route('**/api/v1/corpus', async (route) => {
        await route.fulfill({
          json: documentIds.map((id) => ({ id, title: `Article ${id}`, authors: ['A. Author'] })),
        });
      });
      await page.route('**/api/v1/clustering', async (route) => {
        await route.fulfill({ json: response });
      });
    });

    for (const width of [1440, 1024, 390]) {
      test(`at ${width}px, every dendrogram's own SVG fits inside its card, with no internal horizontal scroll and no text overlap`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/clustering');
        await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

        for (const linkageId of ['single', 'complete', 'average', 'ward']) {
          const card = page.getByTestId(`linkage-dendrogram-${linkageId}`);
          await expect(card).toBeVisible();

          const region = card.getByRole('region', { name: new RegExp(linkageId, 'i') });
          const [cardBox, svgWidth, regionScrollWidth, regionClientWidth] = await Promise.all([
            card.boundingBox(),
            card.getByRole('img').getAttribute('width'),
            region.evaluate((el) => el.scrollWidth),
            region.evaluate((el) => el.clientWidth),
          ]);
          expect(cardBox).not.toBeNull();
          // The card pads its own content (`Panel`'s own padding), so the
          // SVG only needs to fit that inner content width, never the
          // card's full outer box.
          expect(Number(svgWidth)).toBeLessThanOrEqual(cardBox!.width);
          // No internal horizontal scroll: the region's own scrollable
          // content never exceeds what it visibly shows.
          expect(regionScrollWidth).toBeLessThanOrEqual(regionClientWidth + 1);

          await expectNoTextOverlap(card);
        }

        const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
        expect(scrollWidth).toBeLessThanOrEqual(width);
      });
    }
  });
});
