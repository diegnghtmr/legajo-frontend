import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { AXE_TAGS, hasSuccessfulResponse, trackBackendResponses } from './support/backend.js';
import { isProperRefinement } from './support/partition.js';

/**
 * Flow B, full stack, no mocks: the Ward dendrogram over
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
    // 20-document corpus, not a mocked 6-document fixture.
    await expect(wardDendrogram.locator('[data-leaf-id]')).toHaveCount(20);
    // 19 merge rows for 20 leaves (n - 1), same invariant the backend's own
    // smoke script checks — read from the accessible merge table
    // (`table.sr-only` in Dendrogram.tsx), not recomputed here.
    await expect(wardDendrogram.locator('table tbody tr')).toHaveCount(19);

    // The metrics comparison table (ClusteringMetricsTable) carries the
    // "Silueta"/"Davies–Bouldin" column headers once for the whole table,
    // not per row; the Ward row itself carries the Ward's own values, so
    // "visible evaluation metrics" is proven by both the table's headers
    // and the Ward row's own presence.
    const metricsTable = page.getByRole('table');
    await expect(metricsTable.getByText(/Silueta/i).first()).toBeVisible();
    await expect(metricsTable.getByText(/Davies–Bouldin/).first()).toBeVisible();
    await expect(page.getByTestId('metrics-row-ward')).toBeVisible();

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
    //
    // Every leaf's label is read in ONE `evaluateAll` call, not one
    // Playwright round-trip per leaf: several separate locator reads (the
    // previous version's per-index `.count()`/`.textContent()` awaits) can
    // straddle a re-render — the first few leaves could still show the
    // PREVIOUS cut's labels while the rest already show the new ones,
    // producing a "partition" that never existed in any single paint.
    // `evaluateAll` runs entirely inside the page in one synchronous pass
    // over the current DOM, so every leaf's marker reflects the exact same
    // render.
    async function readPartition(): Promise<number[]> {
      const leaves = wardDendrogram.locator('[data-leaf-id]');
      // `evaluateAll`'s callback runs in the browser, but this project's
      // `tsconfig.node.json` (which governs e2e-fullstack/) has no "dom"
      // lib, so global DOM type names like `Element`/`HTMLElement` don't
      // resolve here — a minimal structural type stands in for them
      // instead of widening this file's lib just for one callback.
      type LabelledNode = { querySelectorAll(selectors: string): { textContent: string | null }[] };
      const labels = await leaves.evaluateAll((elements) =>
        (elements as LabelledNode[]).map((element) => {
          // Each leaf shows its cluster as a compact numeric marker. Exactly
          // one marker per leaf — not zero (unassigned) and not two (e.g. a
          // stale marker left over from a previous cut).
          const markers = Array.from(
            element.querySelectorAll('[data-testid="cluster-marker"]'),
          ).map((node) => node.textContent?.trim() ?? '');
          return markers.length === 1 && /^\d+$/.test(markers[0]) ? markers[0] : null;
        }),
      );
      if (labels.length === 0 || labels.some((label) => label === null)) {
        return []; // not settled yet; the caller's poll retries.
      }
      return labels.map((label) => Number(label));
    }

    async function applyCutAndReadPartition(k: number): Promise<number[]> {
      await page.getByLabel(/^k: entre 2 y/).fill(String(k));
      await page.getByRole('button', { name: 'Aplicar corte' }).click();
      await expect(wardDendrogram.getByTestId('dendrogram-cut-line')).toBeAttached();

      // The cut line being attached proves a NEW cut was drawn, but not that
      // every leaf's own cluster marker has re-rendered for it yet:
      // React can commit the cut line and the per-leaf markers in separate
      // paints, so reading the labels immediately after could still observe
      // the PREVIOUS cut's assignment for some leaves. Poll until the
      // partition reflects exactly k distinct clusters over all 20 leaves
      // before treating it as settled; this still asserts the exact same
      // thing, just retries while it isn't true yet instead of only
      // checking once.
      let partition: number[] = [];
      await expect(async () => {
        partition = await readPartition();
        expect(partition).toHaveLength(20);
        expect(new Set(partition).size).toBe(k);
      }).toPass({ timeout: 10_000 });
      return partition;
    }

    // applyCutAndReadPartition's own poll (above) already proves each
    // partition covers all 20 documents exactly once and has exactly k
    // distinct labels — asserting that again here would only repeat it.
    // The backend never promises label ids form a particular set
    // (`POST /clustering/cut` returns `labels: number[]`, not a contiguous
    // 0..k-1 range), so nothing here checks for specific ids either.
    const k3Partition = await applyCutAndReadPartition(3);
    const k2Partition = await applyCutAndReadPartition(2);

    // The one meaningful check left: k=3 must be a genuine refinement of
    // k=2 — every k=3 group nested inside exactly one k=2 group — which is
    // what cutting the SAME Ward dendrogram at a larger k always produces.
    // See partition.ts for why comparing the two partitions for plain
    // inequality instead would be tautological (they already have a
    // different distinct-label count by construction) and partition.spec.ts
    // for the isolated proof that this check does reject a non-nested or
    // identically-grouped pair.
    expect(isProperRefinement(k3Partition, k2Partition)).toBe(true);

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
