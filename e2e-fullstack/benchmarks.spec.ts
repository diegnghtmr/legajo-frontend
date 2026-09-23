import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { AXE_TAGS, BACKEND_BASE_URL, trackBackendRequests } from './support/backend.js';

interface BenchmarkHarness {
  cpuModel: string;
  jdk: string;
}

interface BenchmarkReport {
  harness: BenchmarkHarness;
}

/**
 * Benchmarks screen, full stack, no mocks: renders the real, versioned JMH
 * CSV data the backend serves (TRD §6.6 `GET /benchmarks`), not the
 * hand-shaped fixture the mocked `e2e/benchmarks.spec.ts` uses.
 * `no-mocks.guard.spec.ts` enforces there is no `page.route` anywhere in
 * this directory.
 */
test.describe('benchmarks (full stack)', () => {
  test('renders the real harness info and at least one chart', async ({ page, request }) => {
    const backendRequests = trackBackendRequests(page);

    const backendResponse = await request.get(`${BACKEND_BASE_URL}/api/v1/benchmarks`);
    expect(backendResponse.ok()).toBe(true);
    const report = (await backendResponse.json()) as BenchmarkReport;

    await page.goto('/benchmarks');

    // The screen title is stable regardless of harness content.
    await expect(
      page.getByRole('heading', { name: 'Benchmarks de rendimiento (JMH)' }),
    ).toBeVisible();

    // Real harness fields, fetched straight from the same backend endpoint
    // the page itself calls — not a hardcoded machine description.
    await expect(page.getByText(report.harness.cpuModel)).toBeVisible();
    await expect(page.getByText(report.harness.jdk)).toBeVisible();

    // At least one curve chart group actually rendered (real CSV data has
    // pairwise/HAC/internal-metric families, TRD §6.5/§6.6).
    const chartGroups = page.getByRole('group');
    expect(await chartGroups.count()).toBeGreaterThan(0);
    await expect(chartGroups.first()).toBeVisible();

    // Both embedding dimensions from the fixed local/API providers (ADR
    // pinned in TRD §8: MiniLM 384, Gemini 1536).
    await expect(page.getByTestId('embedding-tile-384')).toBeVisible();
    await expect(page.getByTestId('embedding-tile-1536')).toBeVisible();

    expect(backendRequests.urls.some((url) => url.includes('/api/v1/benchmarks'))).toBe(true);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the benchmarks screen', async ({
    page,
  }) => {
    await page.goto('/benchmarks');
    await expect(
      page.getByRole('heading', { name: 'Benchmarks de rendimiento (JMH)' }),
    ).toBeVisible();
    await expect(page.getByTestId('embedding-tile-1536')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
