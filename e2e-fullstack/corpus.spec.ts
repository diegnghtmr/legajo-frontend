import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { AXE_TAGS, fetchCorpus, trackBackendRequests } from './support/backend.js';

/**
 * Full-stack corpus screen (F3, no mocks): against the real backend and the
 * real, versioned 20-document corpus (TRD §6.1) — no `page.route` anywhere
 * in this suite (enforced by `no-mocks.guard.spec.ts`).
 */
test.describe('corpus screen (full stack)', () => {
  test('lists all 20 real corpus documents, fetched over the network from the real backend', async ({
    page,
    request,
  }) => {
    const backendRequests = trackBackendRequests(page);
    const corpus = await fetchCorpus(request);
    expect(corpus).toHaveLength(20);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Artículos del corpus' })).toBeVisible();

    // One selectable article per real corpus document — the count is the
    // stable assertion (TRD §6.1: exactly 20), not any one document's title.
    await expect(page.getByRole('checkbox')).toHaveCount(20);

    // Direct proof the browser itself talked to the real backend, not a
    // same-origin/cached response.
    expect(backendRequests.urls.some((url) => url.includes('/api/v1/corpus'))).toBe(true);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the corpus screen', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Artículos del corpus' })).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(20);

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
