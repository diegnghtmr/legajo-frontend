import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { AXE_TAGS, hasSuccessfulResponse, trackBackendResponses } from './support/backend.js';

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
    const backendResponses = trackBackendResponses(page);

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

    expect(hasSuccessfulResponse(backendResponses, '/api/v1/clustering')).toBe(true);
  });

  test('applying a k-cut on Ward assigns every document to exactly one of exactly k clusters, and changing k changes the partition', async ({
    page,
  }) => {
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Ward' })).toBeVisible();

    const cutGroup = page.getByRole('radiogroup', { name: 'Enlace a cortar' });
    await cutGroup.getByRole('radio', { name: 'Ward' }).click();
    const wardDendrogram = page.getByTestId('linkage-dendrogram-ward');

    // Applies k and reads back the actual per-leaf cluster assignment: one
    // number per `[data-leaf-id]` leaf, read from THAT leaf's own cluster
    // label text (Dendrogram.tsx's `memberLabel`), not a directory-wide text
    // count — a directory-wide count can't tell "20 leaves each labeled a
    // distinct cluster" apart from "20 leaves all labeled the same cluster"
    // (a degenerate, wrong partition that would still total 20 matches).
    async function readPartition(): Promise<number[]> {
      const leaves = wardDendrogram.locator('[data-leaf-id]');
      const leafCount = await leaves.count();
      const partition: number[] = [];
      for (let index = 0; index < leafCount; index += 1) {
        const clusterLabel = leaves.nth(index).locator('text', { hasText: /^Clúster \d+$/ });
        // Exactly one cluster label per leaf — not zero (unassigned) and not
        // two (e.g. a stale label left over from a previous cut).
        if ((await clusterLabel.count()) !== 1) {
          return []; // not settled yet; the caller's poll retries.
        }
        const text = await clusterLabel.textContent();
        partition.push(Number(text?.replace(/\D/g, '')));
      }
      return partition;
    }

    async function applyCutAndReadPartition(k: number): Promise<number[]> {
      await page.getByLabel(/Número de clústeres k/).fill(String(k));
      await page.getByRole('button', { name: 'Aplicar corte' }).click();
      await expect(wardDendrogram.getByTestId('dendrogram-cut-line')).toBeAttached();

      // The cut line being attached proves a NEW cut was drawn, but not
      // that every leaf's own cluster-label text has re-rendered for it yet
      // — a real, one-time flake this review caught: reading the labels
      // immediately after could still see the PREVIOUS cut's assignment for
      // some leaves. Poll until the partition reflects exactly k distinct
      // clusters over all 20 leaves before treating it as settled; this
      // still asserts the exact same thing, just retries while it isn't
      // true yet instead of only checking once.
      let partition: number[] = [];
      await expect(async () => {
        partition = await readPartition();
        expect(partition).toHaveLength(20);
        expect(new Set(partition).size).toBe(k);
      }).toPass({ timeout: 10_000 });
      return partition;
    }

    const k3Partition = await applyCutAndReadPartition(3);
    // Every one of the 20 real documents assigned exactly once.
    expect(k3Partition).toHaveLength(20);
    const k3Distinct = new Set(k3Partition);
    // Exactly k=3 clusters appear — not "20 matches of some label", which a
    // degenerate all-same-cluster partition would also satisfy.
    expect(k3Distinct.size).toBe(3);
    expect([...k3Distinct].sort((a, b) => a - b)).toEqual([0, 1, 2]);

    const k2Partition = await applyCutAndReadPartition(2);
    expect(k2Partition).toHaveLength(20);
    const k2Distinct = new Set(k2Partition);
    expect(k2Distinct.size).toBe(2);
    // Changing k actually changes the partition, not just its label count.
    expect(k2Partition).not.toEqual(k3Partition);

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
