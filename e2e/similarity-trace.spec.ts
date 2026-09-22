import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped trace payloads (TRD §6.3 `GET /similarity/{algorithmId}/trace`)
 * — no live backend: `page.route` intercepts every request, per the other
 * suites' offline pattern.
 */
const DP_TRACE = {
  algorithmId: 'levenshtein',
  rowLabels: ['', 'k', 'i', 't'],
  columnLabels: ['', 's', 'i', 't'],
  matrix: [
    [0, 1, 2, 3],
    [1, 1, 2, 3],
    [2, 2, 1, 2],
    [3, 3, 2, 1],
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

const JACCARD_TRACE = {
  algorithmId: 'jaccard',
  setA: ['algorithm', 'similarity', 'token'],
  setB: ['similarity', 'token', 'corpus'],
  intersectionSize: 2,
  unionSize: 4,
  intersection: ['similarity', 'token'],
  union: ['algorithm', 'similarity', 'token', 'corpus'],
  coefficient: 0.5,
};

async function mockTrace(page: Page, algorithmId: string, trace: unknown) {
  await page.route(`**/api/v1/similarity/${algorithmId}/trace**`, async (route) => {
    await route.fulfill({ json: trace });
  });
}

test.describe('similarity trace view', () => {
  test('DP trace: renders the complete matrix, marks the optimal path, and downloads the full CSV', async ({
    page,
  }) => {
    await mockTrace(page, 'levenshtein', DP_TRACE);

    await page.goto('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

    await expect(page.getByRole('heading', { name: 'Traza: levenshtein' })).toBeVisible();

    // Every cell of the 4x4 matrix is present, never a truncated subset.
    await expect(page.locator('table').first().locator('td')).toHaveCount(16);

    // Exactly the four optimal-path cells are marked.
    await expect(page.locator('[data-optimal-path="true"]')).toHaveCount(4);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /CSV/i }).click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream ?? []) {
      chunks.push(chunk as Buffer);
    }
    const csv = Buffer.concat(chunks).toString('utf-8');
    const lines = csv.trim().split('\r\n');

    // Header row + one row per matrix row; every cell value present.
    expect(lines).toHaveLength(DP_TRACE.matrix.length + 1);
    for (let row = 0; row < DP_TRACE.matrix.length; row += 1) {
      for (const value of DP_TRACE.matrix[row]) {
        expect(lines[row + 1].split(',')).toContain(String(value));
      }
    }
  });

  test('non-DP trace (Jaccard): renders the token sets, sizes, and coefficient', async ({
    page,
  }) => {
    await mockTrace(page, 'jaccard', JACCARD_TRACE);

    await page.goto('/similarity/jaccard/trace?documentIdA=doc-01&documentIdB=doc-02');

    await expect(page.getByRole('heading', { name: 'Traza: jaccard' })).toBeVisible();
    await expect(page.getByText('0.500000')).toBeVisible();
    await expect(page.getByRole('region', { name: /intersecci/i })).toContainText('similarity');
    await expect(page.getByRole('region', { name: /uni[oó]n/i })).toContainText('corpus');
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the trace view', async ({
    page,
  }) => {
    await mockTrace(page, 'levenshtein', DP_TRACE);

    await page.goto('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');
    await expect(page.getByRole('heading', { name: 'Traza: levenshtein' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
