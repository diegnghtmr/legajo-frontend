import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { expectNoTextOverlap } from './support/textOverlap.js';

/**
 * Contract-shaped payloads (`GET /corpus`, `POST /similarity/matrix`)
 * — no live backend: `page.route` intercepts every request so this suite
 * runs fully offline.
 */
const CORPUS_SUMMARIES = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['B. Two'] },
  { id: 'doc-03', title: 'Clustering theory refresher', authors: ['C. Three'] },
];

function cell(
  normalizedScore: number,
  overrides: Partial<{ cached: boolean; degenerate: boolean }> = {},
) {
  return {
    normalizedScore,
    rawValue: normalizedScore,
    computedNanos: 4200,
    cached: overrides.cached ?? false,
    degenerate: overrides.degenerate ?? false,
    stemming: false,
  };
}

const LEVENSHTEIN_MATRIX = [
  [cell(1), cell(0.72), cell(0.4)],
  [cell(0.72), cell(1), cell(0.6, { cached: true })],
  [cell(0.4), cell(0.6, { cached: true }), cell(1)],
];

const JACCARD_MATRIX = [
  [cell(1), cell(0.3), cell(0.1)],
  [cell(0.3), cell(1), cell(0.2)],
  [cell(0.1), cell(0.2), cell(1)],
];

async function mockMatrixApi(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/similarity/matrix', async (route) => {
    const body = route.request().postDataJSON() as { algorithmId: string };
    await route.fulfill({
      json: body.algorithmId === 'jaccard' ? JACCARD_MATRIX : LEVENSHTEIN_MATRIX,
    });
  });
}

async function selectThreeArticlesAndOpenMatrix(page: Page) {
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
  await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
  await page.getByRole('checkbox', { name: 'Clustering theory refresher' }).check();

  const matrixButton = page.getByRole('button', { name: 'Ver matriz de 3' });
  await expect(matrixButton).toBeEnabled();
  await matrixButton.click();
}

test.describe('similarity matrix screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockMatrixApi(page);
  });

  test('selecting three articles and opening the matrix shows a 3x3 grid with diagonal 1.000', async ({
    page,
  }) => {
    await selectThreeArticlesAndOpenMatrix(page);

    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toBeVisible();
    await expect(page.getByText('1.000').first()).toBeVisible();

    const values = await page.getByText(/^\d\.\d{3}$/).all();
    expect(values).toHaveLength(9);

    const diagonalValues = await page.getByText('1.000').all();
    expect(diagonalValues).toHaveLength(3);
  });

  test('shows the four heat buckets in a legend under the matrix', async ({ page }) => {
    await selectThreeArticlesAndOpenMatrix(page);

    const legend = page.getByRole('list', { name: 'Escala de color' });
    await expect(legend.getByRole('listitem')).toHaveText([
      '< 0.25',
      '0.25–0.5',
      '0.5–0.75',
      '≥ 0.75',
    ]);
    const table = page.getByRole('region', { name: /Matriz de similitud por pares/ });
    const tableBox = await table.boundingBox();
    const legendBox = await legend.boundingBox();
    expect(legendBox!.y).toBeGreaterThanOrEqual(tableBox!.y + tableBox!.height);
  });

  test('switching the algorithm re-requests and re-renders the matrix', async ({ page }) => {
    await selectThreeArticlesAndOpenMatrix(page);

    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toBeVisible();
    await expect(page.getByText('0.720').first()).toBeVisible();

    const group = page.getByRole('radiogroup', { name: 'Algoritmo de la matriz' });
    await group.getByRole('radio', { name: 'jaccard' }).click();

    await expect(page.getByText('0.300').first()).toBeVisible();
    await expect(page.getByText('0.720')).toHaveCount(0);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the matrix screen', async ({
    page,
  }) => {
    await selectThreeArticlesAndOpenMatrix(page);

    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toBeVisible();
    await expect(page.getByText('1.000').first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('has no empty-table-header violation on the matrix’s own sticky corner cell', async ({
    page,
  }) => {
    // `empty-table-header` is a best-practice rule, not one of the strict
    // WCAG tags the axe pass above filters by — this one targets it
    // directly, reproducing the reported violation on the sticky top-left
    // corner `<th>`, which otherwise carries no text at all.
    await selectThreeArticlesAndOpenMatrix(page);

    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toBeVisible();
    await expect(page.getByText('1.000').first()).toBeVisible();

    const results = await new AxeBuilder({ page }).withRules(['empty-table-header']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('at lg and above, selecting a third article shows the matrix directly, with no click on the CTA', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('checkbox', { name: 'Clustering theory refresher' }).check();

    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toBeVisible();
    await expect(page).toHaveURL(/\/similarity$/);
  });

  test('below lg (390px), the corpus list stays the main content until the tray CTA confirms the matrix', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('checkbox', { name: 'Clustering theory refresher' }).check();

    // Unchanged below lg: the matrix never shows until the tray's own CTA
    // is activated.
    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toHaveCount(0);
    await expect(
      page.getByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeVisible();

    const matrixButton = page.getByRole('button', { name: 'Ver matriz de 3' });
    await expect(matrixButton).toBeEnabled();
    await matrixButton.click();

    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toBeVisible();
  });

  test('has no overlapping text in the matrix at 3 selected', async ({ page }) => {
    await selectThreeArticlesAndOpenMatrix(page);

    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toBeVisible();
    await expect(page.getByText('1.000').first()).toBeVisible();

    await expectNoTextOverlap(
      page.getByRole('region', { name: 'Matriz de similitud por pares para el algoritmo elegido' }),
    );
  });

  /** 20 documents (the reference corpus size), so a 21-column/21-row table
   * (id header + 20 data columns) is wide enough to expose a page-level
   * horizontal scroll regression that a 3x3 matrix never would. */
  function mockTwentyDocumentMatrix() {
    const documents = Array.from({ length: 20 }, (_unused, index) => ({
      id: `doc-${String(index + 1).padStart(2, '0')}`,
      title: `Article number ${index + 1}`,
      authors: ['A. Author'],
    }));
    const matrix = documents.map((_row, rowIndex) =>
      documents.map((_col, colIndex) =>
        // Half the off-diagonal cells are `cached: true` — the reference
        // corpus's own symmetric-pair caching means this is the realistic
        // shape (never all-false, which would hide the sr-only cached-marker
        // spans this scroll regression is actually about).
        cell(rowIndex === colIndex ? 1 : 0.1 * ((rowIndex + colIndex) % 9), {
          cached: rowIndex !== colIndex && colIndex > rowIndex,
        }),
      ),
    );
    return { documents, matrix };
  }

  async function selectTwentyArticlesAndOpenMatrix(page: Page) {
    const { documents, matrix } = mockTwentyDocumentMatrix();
    await page.route('**/api/v1/corpus', async (route) => {
      await route.fulfill({ json: documents });
    });
    await page.route('**/api/v1/similarity/matrix', async (route) => {
      await route.fulfill({ json: matrix });
    });

    await page.goto('/');
    for (const document of documents) {
      await page.getByRole('checkbox', { name: document.title, exact: true }).check();
    }

    // At lg and above the matrix already shows with no click (the
    // auto-follow rule); below lg the corpus list stays the main content
    // until the tray's own CTA confirms it — the same distinction the
    // "below lg" test above already exercises.
    const isAtLeastLg = (page.viewportSize()?.width ?? 0) >= 1024;
    const matrixHeading = page.getByRole('heading', { name: 'Matriz de similitud' });
    if (!isAtLeastLg) {
      await page.getByRole('button', { name: 'Ver matriz de 20' }).click();
    }
    await expect(matrixHeading).toBeVisible();
  }

  test('has no overlapping text in the matrix at 20 selected', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await selectTwentyArticlesAndOpenMatrix(page);

    await expect(
      page
        .getByRole('region', { name: 'Matriz de similitud por pares para el algoritmo elegido' })
        .getByText('1.000')
        .first(),
    ).toBeVisible();

    await expectNoTextOverlap(
      page.getByRole('region', { name: 'Matriz de similitud por pares para el algoritmo elegido' }),
    );
  });

  for (const width of [1440, 1024, 390]) {
    test(`at ${width}px, a 20x20 matrix scrolls inside its own region, never the page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await selectTwentyArticlesAndOpenMatrix(page);

      const matrixRegion = page.getByRole('region', {
        name: 'Matriz de similitud por pares para el algoritmo elegido',
      });
      await expect(matrixRegion.getByText('1.000').first()).toBeVisible();

      // The region's own internal scroll area is expected to be wider than
      // the viewport (21 sticky columns at min-w-16 each) — only the
      // document must never grow past its own viewport width.
      const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
      expect(scrollWidth).toBeLessThanOrEqual(width);
    });
  }
});
