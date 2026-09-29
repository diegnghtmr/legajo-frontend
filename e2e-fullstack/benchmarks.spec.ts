import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Locator, test } from '@playwright/test';

import {
  AXE_TAGS,
  BACKEND_BASE_URL,
  hasSuccessfulResponse,
  trackBackendResponses,
} from './support/backend.js';

interface BenchmarkHarness {
  cpuModel: string;
  jdk: string;
}

interface BenchmarkReport {
  harness: BenchmarkHarness;
}

/**
 * Requires an actual plotted Recharts line inside a `role=group` chart
 * container, with real (non-empty) path geometry — a generic `role=group`
 * count only proves SOME element with that role exists, not that a chart
 * actually rendered, since an empty placeholder div could carry the same
 * role. Shared by all three chart groups in the test below: checking only
 * the first group, or asserting just `data-scale` (which a chart with zero
 * plotted points could still carry) on the other two, would let a
 * regression that emptied their data go unnoticed.
 */
async function expectPlottedLine(group: Locator) {
  const plottedLine = group.locator('svg.recharts-surface path.recharts-line-curve').first();
  await expect(plottedLine).toBeVisible();
  const pathGeometry = await plottedLine.getAttribute('d');
  expect(pathGeometry).toBeTruthy();
  expect(pathGeometry!.length).toBeGreaterThan(0);
}

/**
 * Benchmarks screen, full stack, no mocks: renders the real, versioned JMH
 * CSV data the backend serves from `GET /benchmarks`, not the
 * hand-shaped fixture the mocked `e2e/benchmarks.spec.ts` uses.
 * `no-mocks.guard.spec.ts` enforces there is no `page.route` anywhere in
 * this directory.
 */
test.describe('benchmarks (full stack)', () => {
  test('renders the real harness info and a real chart with plotted data', async ({
    page,
    request,
  }) => {
    const backendResponses = trackBackendResponses(page);

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
    // The panel renders the CPU's (R)/(TM) marks as ® and ™.
    const cpuModel = report.harness.cpuModel.replace(/\(R\)/gi, '®').replace(/\(TM\)/gi, '™');
    await expect(page.getByText(cpuModel)).toBeVisible();
    await expect(page.getByText(report.harness.jdk)).toBeVisible();

    // Target the real chart group (BenchmarkCurveChart.tsx: `role="group"`
    // with the app's own `data-scale` attribute) and require an actual
    // plotted line with real geometry, not just the group's presence.
    const classicGroup = page.getByRole('group', { name: 'Algoritmos clásicos por pares' });
    await expect(classicGroup).toBeVisible();
    await expect(classicGroup).toHaveAttribute('data-scale', 'linear');
    await expectPlottedLine(classicGroup);

    // The other two curve chart groups (real CSV data has HAC-linkage and
    // internal-metric families too) are present as real
    // charts WITH plotted data as well, not just counted or checked for the
    // `data-scale` attribute alone (which an empty chart could also carry).
    for (const name of ['Enlaces jerárquicos (HAC)', 'Métricas internas de agrupamiento']) {
      const group = page.getByRole('group', { name });
      await expect(group).toBeVisible();
      await expect(group).toHaveAttribute('data-scale', 'linear');
      await expectPlottedLine(group);
    }

    // Both embedding dimensions from the fixed local/API providers
    // (MiniLM 384, Gemini 1536).
    await expect(page.getByTestId('embedding-tile-384')).toBeVisible();
    await expect(page.getByTestId('embedding-tile-1536')).toBeVisible();

    expect(hasSuccessfulResponse(backendResponses, '/api/v1/benchmarks')).toBe(true);
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
