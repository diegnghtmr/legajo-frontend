import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  AXE_TAGS,
  fetchCorpus,
  hasSuccessfulResponse,
  trackBackendResponses,
} from './support/backend.js';

/** The versioned reference corpus has exactly 20 documents (d01..d20). */
const EXPECTED_CORPUS_SIZE = 20;

/**
 * Full-stack corpus screen (no mocks): against the real backend and the
 * real, versioned 20-document corpus — no `page.route` anywhere
 * in this suite (enforced by `no-mocks.guard.spec.ts`).
 */
test.describe('corpus screen (full stack)', () => {
  test('lists all 20 real corpus documents, fetched over the network from the real backend', async ({
    page,
    request,
  }) => {
    const backendResponses = trackBackendResponses(page);
    const corpus = await fetchCorpus(request);
    expect(corpus).toHaveLength(EXPECTED_CORPUS_SIZE);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Artículos del corpus' })).toBeVisible();

    // One selectable article per real corpus document — derived from the
    // backend's own response fetched above (cheap: already in hand), not a
    // second hardcoded literal that could silently drift from the first if
    // the corpus content ever changes.
    await expect(page.getByRole('checkbox')).toHaveCount(corpus.length);

    // Direct proof the browser itself completed a real HTTP round trip with
    // the backend (a 2xx response), not merely dispatched a request that
    // may have been aborted, refused, or never answered.
    expect(hasSuccessfulResponse(backendResponses, '/api/v1/corpus')).toBe(true);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the corpus screen', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Artículos del corpus' })).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(EXPECTED_CORPUS_SIZE);

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
