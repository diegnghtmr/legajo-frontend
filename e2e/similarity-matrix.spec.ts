import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped payloads (TRD §6.6 `GET /corpus`, `POST /similarity/matrix`)
 * — no live backend: `page.route` intercepts every request so this suite
 * runs fully offline, per the task's e2e instructions.
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

  const matrixButton = page.getByRole('button', { name: 'Ver matriz' });
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
});
