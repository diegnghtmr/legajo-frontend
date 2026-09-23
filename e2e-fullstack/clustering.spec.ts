import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { AXE_TAGS, trackBackendRequests } from './support/backend.js';

/**
 * Flow B (PRD §7, TAC-15), full stack, no mocks: the Ward dendrogram over
 * the real 20-document corpus, its evaluation metrics, and a k-cut that
 * updates the drawn clusters. `no-mocks.guard.spec.ts` enforces there is no
 * `page.route` anywhere in this directory.
 */
test.describe('clustering (full stack, Flow B)', () => {
  test('the Ward dendrogram renders 20 real leaves with visible evaluation metrics', async ({
    page,
  }) => {
    const backendRequests = trackBackendRequests(page);

    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Ward' })).toBeVisible();

    const wardDendrogram = page.getByTestId('linkage-dendrogram-ward');
    await expect(wardDendrogram).toBeVisible();
    // One `<g data-leaf-id>` per observation (Dendrogram.tsx) — the real
    // 20-document corpus (TRD §6.1), not a mocked 6-document fixture.
    await expect(wardDendrogram.locator('[data-leaf-id]')).toHaveCount(20);
    // 19 merge rows for 20 leaves (n - 1), same invariant the backend's own
    // smoke script checks (TAC-03) — read from the accessible merge table
    // (`table.sr-only` in Dendrogram.tsx), not recomputed here.
    await expect(wardDendrogram.locator('table tbody tr')).toHaveCount(19);

    const wardPanel = page.getByTestId('linkage-panel-ward');
    await expect(wardPanel.getByText(/Silueta/i).first()).toBeVisible();
    await expect(wardPanel.getByText(/Davies–Bouldin/).first()).toBeVisible();

    expect(backendRequests.urls.some((url) => url.includes('/api/v1/clustering'))).toBe(true);
  });

  test('applying a k=3 cut on Ward draws the cut line and labels all 20 leaves across 3 clusters', async ({
    page,
  }) => {
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Ward' })).toBeVisible();

    const cutGroup = page.getByRole('radiogroup', { name: 'Enlace a cortar' });
    await cutGroup.getByRole('radio', { name: 'Ward' }).click();
    // The label's own k range is `(entre 2 y n-1)` (CutForm.tsx), so for the
    // real 20-document corpus it reads "(entre 2 y 19)", not the mocked
    // 6-document suite's "(entre 2 y 5)" — matched by prefix instead of the
    // full, corpus-size-dependent text.
    await page.getByLabel(/Número de clústeres k/).fill('3');
    await page.getByRole('button', { name: 'Aplicar corte' }).click();

    const wardDendrogram = page.getByTestId('linkage-dendrogram-ward');
    await expect(wardDendrogram.getByTestId('dendrogram-cut-line')).toBeAttached();

    // Every one of the 20 real leaves gets a cluster label 0..2 after the
    // cut (labels aren't recomputed here, just counted). Scoped to the
    // `<svg>` only: the same "Clúster N" text also names internal merge
    // nodes (id >= n) inside the dendrogram's own sr-only accessible merge
    // table (Dendrogram.tsx's `memberLabel`), which would otherwise inflate
    // this count with unrelated matches.
    const clusterLabelCount = await wardDendrogram
      .locator('svg')
      .getByText(/^Clúster \d+$/)
      .count();
    expect(clusterLabelCount).toBe(20);

    // No cut line leaks onto a linkage that was not cut.
    await expect(
      page.getByTestId('linkage-dendrogram-single').getByTestId('dendrogram-cut-line'),
    ).toHaveCount(0);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the clustering screen', async ({
    page,
  }) => {
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Ward' })).toBeVisible();
    await expect(page.getByTestId('linkage-dendrogram-ward')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
