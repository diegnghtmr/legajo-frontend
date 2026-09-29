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
    await page.getByLabel('k: entre 2 y 5').fill('3');
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
    test(`at ${width}px, the parameter panel's columns stay top-aligned, never stretch to each other's height and never scroll the page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/clustering');
      await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

      // A column is the header row's grandparent: heading, its baseline
      // row, the header row, the column itself.
      const column = (title: string) =>
        page.getByRole('heading', { name: title, level: 3 }).locator('xpath=../../..');
      const columns = [
        column('Representación'),
        column('Selección de enlaces'),
        column('Corte libre'),
      ];

      // Never stretched to fill the remaining row width or the row height:
      // each column's own computed `flex-grow` stays 0.
      for (const item of columns) {
        expect(await computedFlexGrow(item)).toBe('0');
      }

      const boxes = await Promise.all(columns.map((item) => item.boundingBox()));
      expect(boxes.every((box) => box !== null)).toBe(true);
      const [representationBox, linkageBox, cutBox] = boxes as NonNullable<
        (typeof boxes)[number]
      >[];

      // While the columns share one row they are top-aligned, and the free
      // cut column keeps its own (taller) height: none is stretched to
      // another's, and none reserves a dead block for it.
      const sameRow =
        Math.abs(representationBox!.y - cutBox!.y) < 5 && Math.abs(linkageBox!.y - cutBox!.y) < 5;
      if (sameRow) {
        expect(representationBox!.height).toBeLessThan(cutBox!.height);
        expect(linkageBox!.height).toBeLessThan(cutBox!.height);
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

    const field = page.getByLabel('k: entre 2 y 5');
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
    const single = page.getByTestId('linkage-dendrogram-single');
    await expect(single.getByRole('img')).toBeVisible();

    await expect(single.locator('[data-axis-title]')).toHaveText('Distancia');
    expect(await single.locator('[data-axis-tick]').count()).toBeGreaterThanOrEqual(3);

    // The default k (2) is previewed on the linkage to cut, before any cut.
    await expect(single.getByTestId('dendrogram-preview-label')).toHaveText('k = 2');
    await expect(
      page.getByTestId('linkage-dendrogram-complete').getByTestId('dendrogram-preview-line'),
    ).toHaveCount(0);

    await single.locator('[data-leaf-id="0"]').hover();
    const leafTip = page.getByRole('tooltip');
    await expect(leafTip).toContainText('doc-01');
    await expect(leafTip).toContainText('Article 1');

    await single.locator('[data-merge-hit="6"]').hover({ force: true });
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
    await page.getByLabel('k: entre 2 y 5').fill('3');
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

  test.describe('parameter panel grid', () => {
    interface ColumnMeasure {
      width: number;
      borderLeft: number;
      borderTop: number;
    }
    interface PanelMeasure {
      columns: ColumnMeasure[];
      footerBackground: string;
      footerHeight: number;
      sunkenToken: string;
    }

    /** Measured in the browser, so the assertions read computed layout, not class names. */
    async function measurePanel(page: Page): Promise<PanelMeasure> {
      const panel = page.getByRole('region', { name: 'Parámetros del agrupamiento' });
      await expect(panel.getByTestId('params-status-footer')).toBeVisible();
      return panel.evaluate((section): PanelMeasure => {
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
        const grid = section.firstElementChild!;
        const footer = section.querySelector('[data-testid="params-status-footer"]')!;
        const probe = env.document.createElement('div');
        probe.className = 'bg-paper-sunken';
        env.document.body.appendChild(probe);
        const sunkenToken = env.getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          columns: Array.from(
            grid.children as Iterable<{ getBoundingClientRect(): { width: number } }>,
          ).map((column) => {
            const style = env.getComputedStyle(column);
            return {
              width: column.getBoundingClientRect().width,
              borderLeft: parseFloat(style.borderLeftWidth),
              borderTop: parseFloat(style.borderTopWidth),
            };
          }),
          footerBackground: env.getComputedStyle(footer).backgroundColor,
          footerHeight: footer.getBoundingClientRect().height,
          sunkenToken,
        };
      });
    }

    test('at 1440px the three columns split 1 : 1 : 1.35 with a 1px rule between them and a sunken footer', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/clustering');
      const measure = await measurePanel(page);

      expect(measure.columns).toHaveLength(3);
      const [first, second, third] = measure.columns;
      expect(second.width / first.width).toBeGreaterThan(0.95);
      expect(second.width / first.width).toBeLessThan(1.05);
      expect(third.width / first.width).toBeGreaterThan(1.35 * 0.95);
      expect(third.width / first.width).toBeLessThan(1.35 * 1.05);
      expect([first.borderLeft, second.borderLeft, third.borderLeft]).toEqual([0, 1, 1]);
      expect([first.borderTop, second.borderTop, third.borderTop]).toEqual([0, 0, 0]);
      expect(measure.footerBackground).toBe(measure.sunkenToken);
      expect(measure.footerHeight).toBeGreaterThanOrEqual(44);

      await page
        .getByRole('region', { name: 'Parámetros del agrupamiento' })
        .screenshot({ path: 'test-results/clustering-params-1440.png' });
    });

    for (const width of [1024, 390]) {
      test(`at ${width}px the columns stack with top rules and the page does not scroll sideways`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/clustering');
        const measure = await measurePanel(page);

        const [first, second, third] = measure.columns;
        expect([first.borderTop, second.borderTop, third.borderTop]).toEqual([0, 1, 1]);
        expect([first.borderLeft, second.borderLeft, third.borderLeft]).toEqual([0, 0, 0]);
        expect(second.width).toBeCloseTo(first.width, 0);
        expect(third.width).toBeCloseTo(first.width, 0);
        expect(measure.footerBackground).toBe(measure.sunkenToken);

        const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
        expect(scrollWidth).toBeLessThanOrEqual(width);

        await page
          .getByRole('region', { name: 'Parámetros del agrupamiento' })
          .screenshot({ path: `test-results/clustering-params-${width}.png` });
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
