import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { expectNoTextOverlap } from './support/textOverlap.js';

/**
 * Contract-shaped payload (`GET /benchmarks`) — no live
 * backend: `page.route` intercepts the request, same offline pattern every
 * other spec in this suite uses. Shaped after the real reference-run CSVs
 * (`benchmarks/results/jmh-results.csv`/`slopes.csv`), trimmed to two sizes
 * per curve family (enough to draw a line and anchor the theoretical curve)
 * plus both embedding dimensions and all five `slo-*` rows.
 */
function result(overrides: Record<string, unknown>) {
  return {
    benchmark: 'x',
    family: 'levenshtein',
    parameter: 'length',
    size: 50,
    score: 1,
    error: 0.4,
    unit: 'us/op',
    ...overrides,
  };
}

const BENCHMARK_REPORT = {
  harness: {
    cpuModel: '12th Gen Intel(R) Core(TM) i9-12900H',
    logicalCores: 20,
    totalRamBytes: 33_363_460_096,
    jdk: 'Eclipse Adoptium 25.0.4',
    os: 'Linux 7.2.5-3-omarchy (amd64)',
    measuredAt: '2026-09-23T00:43:04.800549029Z',
  },
  results: [
    result({ family: 'levenshtein', size: 50, score: 7.9 }),
    result({ family: 'levenshtein', size: 400, score: 499.0 }),
    result({ family: 'needleman-wunsch', size: 50, score: 7.7 }),
    result({ family: 'needleman-wunsch', size: 400, score: 469.5 }),
    result({ family: 'jaccard', size: 50, score: 4.5 }),
    result({ family: 'jaccard', size: 400, score: 104.6 }),
    result({ family: 'tfidf-cosine', size: 50, score: 6.1 }),
    result({ family: 'tfidf-cosine', size: 400, score: 75.1 }),
    result({ family: 'hac-single', parameter: 'n', size: 5, score: 0.32 }),
    result({ family: 'hac-single', parameter: 'n', size: 80, score: 268.3 }),
    result({ family: 'hac-complete', parameter: 'n', size: 5, score: 0.31 }),
    result({ family: 'hac-complete', parameter: 'n', size: 80, score: 155.2 }),
    result({ family: 'hac-average', parameter: 'n', size: 5, score: 0.33 }),
    result({ family: 'hac-average', parameter: 'n', size: 80, score: 178.7 }),
    result({ family: 'hac-ward', parameter: 'n', size: 5, score: 0.34 }),
    result({ family: 'hac-ward', parameter: 'n', size: 80, score: 168.6 }),
    result({ family: 'mean-silhouette', parameter: 'n', size: 5, score: 0.21 }),
    result({ family: 'mean-silhouette', parameter: 'n', size: 80, score: 14.4 }),
    result({ family: 'davies-bouldin', parameter: 'n', size: 5, score: 115.3 }),
    result({ family: 'davies-bouldin', parameter: 'n', size: 80, score: 1893.9 }),
    result({
      family: 'embedding-dot-product',
      parameter: 'dimension',
      size: 384,
      score: 195,
      unit: 'ns/op',
    }),
    result({
      family: 'embedding-dot-product',
      parameter: 'dimension',
      size: 1536,
      score: 843,
      unit: 'ns/op',
    }),
    result({
      family: 'embedding-euclidean-sum-squared',
      parameter: 'dimension',
      size: 384,
      score: 210,
      unit: 'ns/op',
    }),
    result({
      family: 'embedding-euclidean-sum-squared',
      parameter: 'dimension',
      size: 1536,
      score: 867,
      unit: 'ns/op',
    }),
    result({
      family: 'slo-classic-levenshtein',
      parameter: 'n',
      size: 20,
      score: 11.6,
      unit: 'ms/op',
    }),
    result({
      family: 'slo-classic-needleman-wunsch',
      parameter: 'n',
      size: 20,
      score: 11.7,
      unit: 'ms/op',
    }),
    result({ family: 'slo-classic-jaccard', parameter: 'n', size: 20, score: 7.1, unit: 'ms/op' }),
    result({
      family: 'slo-classic-tfidf-cosine',
      parameter: 'n',
      size: 20,
      score: 7.2,
      unit: 'ms/op',
    }),
    result({ family: 'slo-clustering', parameter: 'n', size: 20, score: 0.017, unit: 'ms/op' }),
  ],
  slopes: [
    { family: 'levenshtein', points: 2, empiricalSlope: 2.04, theoreticalExponent: 2 },
    { family: 'needleman-wunsch', points: 2, empiricalSlope: 2.01, theoreticalExponent: 2 },
    { family: 'jaccard', points: 2, empiricalSlope: 1.48, theoreticalExponent: 1 },
    { family: 'tfidf-cosine', points: 2, empiricalSlope: 1.25, theoreticalExponent: 1 },
    { family: 'hac-single', points: 2, empiricalSlope: 2.37, theoreticalExponent: 3 },
    { family: 'hac-complete', points: 2, empiricalSlope: 2.21, theoreticalExponent: 3 },
    { family: 'hac-average', points: 2, empiricalSlope: 2.23, theoreticalExponent: 3 },
    { family: 'hac-ward', points: 2, empiricalSlope: 2.21, theoreticalExponent: 3 },
    { family: 'mean-silhouette', points: 2, empiricalSlope: 1.46, theoreticalExponent: 2 },
    { family: 'davies-bouldin', points: 2, empiricalSlope: 1.01, theoreticalExponent: 1 },
    { family: 'embedding-dot-product', points: 2, empiricalSlope: 1.06, theoreticalExponent: 1 },
    {
      family: 'embedding-euclidean-sum-squared',
      points: 2,
      empiricalSlope: 1.02,
      theoreticalExponent: 1,
    },
  ],
};

async function mockBenchmarksApi(page: Page) {
  await page.route('**/api/v1/benchmarks', async (route) => {
    await route.fulfill({ json: BENCHMARK_REPORT });
  });
}

test.describe('benchmarks screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockBenchmarksApi(page);
  });

  test('shows the reference-harness rows, one chart per curve group, embedding tiles and SLO evidence', async ({
    page,
  }) => {
    await page.goto('/benchmarks');

    await expect(
      page.getByRole('heading', { name: 'Benchmarks de rendimiento (JMH)' }),
    ).toBeVisible();

    // Harness metadata.
    await expect(page.getByText('12th Gen Intel® Core™ i9-12900H')).toBeVisible();
    await expect(page.getByText('Eclipse Adoptium 25.0.4')).toBeVisible();

    // One chart per curve group.
    await expect(page.getByRole('group', { name: 'Algoritmos clásicos por pares' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Enlaces jerárquicos (HAC)' })).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Métricas internas de agrupamiento' }),
    ).toBeVisible();

    // One tile per embedding dimension, no curve.
    await expect(page.getByTestId('embedding-tile-384')).toBeVisible();
    await expect(page.getByTestId('embedding-tile-1536')).toBeVisible();

    // SLO evidence, text label not color alone.
    await expect(page.getByRole('table', { name: /clásicas por pares/ })).toBeVisible();
    await expect(page.getByRole('table', { name: /cuatro enlaces/ })).toBeVisible();
    expect(await page.getByText(/^dentro \(\d/).count()).toBeGreaterThan(0);
    await expect(page.getByText('excede', { exact: true })).toHaveCount(0);
  });

  test('the linear/log–log Segmented toggle switches every curve chart’s scale', async ({
    page,
  }) => {
    await page.goto('/benchmarks');
    await expect(page.getByRole('group', { name: 'Algoritmos clásicos por pares' })).toBeVisible();

    const chartGroupNames = [
      'Algoritmos clásicos por pares',
      'Enlaces jerárquicos (HAC)',
      'Métricas internas de agrupamiento',
    ];
    for (const name of chartGroupNames) {
      await expect(page.getByRole('group', { name })).toHaveAttribute('data-scale', 'linear');
    }

    const scaleGroup = page.getByRole('radiogroup', { name: 'Escala' });
    await expect(scaleGroup.getByRole('radio', { name: 'Lineal' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await scaleGroup.getByRole('radio', { name: 'Log–log' }).click();

    await expect(scaleGroup.getByRole('radio', { name: 'Log–log' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // The charts stay mounted and visible after the scale switch, and each
    // one actually re-renders on the log axis (not just the toggle itself).
    for (const name of chartGroupNames) {
      const group = page.getByRole('group', { name });
      await expect(group).toBeVisible();
      await expect(group).toHaveAttribute('data-scale', 'log');
    }
  });

  test('at 1440px each chart fills its own card width instead of a fixed ~650px, and at 390px the page never scrolls horizontally', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/benchmarks');

    const group = page.getByRole('group', { name: 'Algoritmos clásicos por pares' });
    await expect(group).toBeVisible();

    // ResizeObserver settles asynchronously, so poll until the chart's own
    // SVG has actually grown to fill its card's measured width -- well past
    // the old fixed ~650px, and close to the card's own content width, not
    // a coincidental match -- rather than asserting once right after the
    // page loads.
    await expect
      .poll(
        async () => {
          const groupBox = await group.boundingBox();
          const svgWidthAttr = await group
            .locator('svg.recharts-surface')
            .first()
            .getAttribute('width');
          if (!groupBox || !svgWidthAttr) {
            return false;
          }
          const svgWidth = Number(svgWidthAttr);
          return svgWidth > 900 && Math.abs(svgWidth - groupBox.width) < 20;
        },
        { message: 'the chart SVG should fill its own card width, not a fixed ~650px' },
      )
      .toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () => page.evaluate<number>('document.documentElement.scrollWidth'), {
        message: 'the page should never scroll horizontally at 390px',
      })
      .toBeLessThanOrEqual(390);
  });

  for (const width of [1440, 390]) {
    for (const scale of ['linear', 'log-log'] as const) {
      test(`at ${width}px on the ${scale} scale, no chart's axis title overlaps its own tick labels`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await page.goto('/benchmarks');

        const group = page.getByRole('group', { name: 'Algoritmos clásicos por pares' });
        await expect(group).toBeVisible();

        if (scale === 'log-log') {
          await page
            .getByRole('radiogroup', { name: 'Escala' })
            .getByRole('radio', { name: 'Log–log' })
            .click();
          await expect(group).toHaveAttribute('data-scale', 'log');
        }

        for (const name of [
          'Algoritmos clásicos por pares',
          'Enlaces jerárquicos (HAC)',
          'Métricas internas de agrupamiento',
        ]) {
          // The outer chart row, not the inner `role="group"` alone: the
          // y-axis title renders as a sibling column outside that group
          // (`BenchmarkCurveChart.tsx`), so scanning only the group would
          // never catch it overlapping a tick label.
          const chartRow = page
            .getByTestId('benchmark-chart-row')
            .filter({ has: page.getByRole('group', { name }) });
          await expectNoTextOverlap(chartRow);
        }
      });
    }
  }

  test("on the log-log scale, every chart's y-axis ticks are powers of ten, never arbitrary sub-multiples", async ({
    page,
  }) => {
    await page.goto('/benchmarks');

    await page
      .getByRole('radiogroup', { name: 'Escala' })
      .getByRole('radio', { name: 'Log–log' })
      .click();

    for (const name of [
      'Algoritmos clásicos por pares',
      'Enlaces jerárquicos (HAC)',
      'Métricas internas de agrupamiento',
    ]) {
      const group = page.getByRole('group', { name });
      await expect(group).toHaveAttribute('data-scale', 'log');

      // Both axes' tick-value text nodes share this one class; the x-axis
      // ticks are bare input sizes (plain integers) while every y-axis
      // (duration) tick carries a unit suffix, so filtering by that suffix
      // picks out only the y-axis ticks without depending on document
      // order or a compound `.recharts-yAxis …` selector (which Playwright
      // could not resolve against this nested SVG structure, unlike a
      // single class selector).
      const allTickTexts = await group
        .locator('.recharts-cartesian-axis-tick-value')
        .allTextContents();
      const durationTickTexts = allTickTexts.filter((text) => /[a-zµ]/.test(text));
      expect(durationTickTexts.length).toBeGreaterThan(0);
      for (const tick of durationTickTexts) {
        // `formatDuration` always renders an exact power of ten as a bare
        // 1/10/100 mantissa (its one-decimal rounding never applies to
        // those) — an arbitrary sub-multiple like "40 µs" or "300 µs"
        // fails this pattern.
        expect(tick).toMatch(/^(1|10|100) (ns|µs|ms|s)$/);
      }
    }
  });

  test('hovering a chart shows the crosshair tooltip with every series at the nearest size, and leaving hides it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/benchmarks');
    const group = page.getByRole('group', { name: 'Algoritmos clásicos por pares' });
    await expect(group.locator('svg.recharts-surface')).toBeVisible();

    const box = (await group.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);

    const tooltip = group.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    for (const family of ['levenshtein', 'needleman-wunsch', 'jaccard', 'tfidf-cosine']) {
      await expect(tooltip.getByText(family)).toBeVisible();
    }
    await expect(tooltip).toContainText('±');
    await expect(group.locator('.recharts-tooltip-cursor')).toHaveAttribute(
      'stroke-opacity',
      '0.25',
    );

    await page.mouse.move(5, 5);
    await expect(tooltip).toBeHidden();
  });

  test('focusing the chart and pressing an arrow key reveals the same tooltip', async ({
    page,
  }) => {
    await page.goto('/benchmarks');
    const group = page.getByRole('group', { name: 'Algoritmos clásicos por pares' });
    const plot = group.locator('svg.recharts-surface');
    await expect(plot).toBeVisible();

    await plot.focus();
    await page.keyboard.press('ArrowRight');

    await expect(group.getByRole('tooltip')).toBeVisible();
  });

  test('focusing a legend item isolates its series and releases it on blur', async ({ page }) => {
    await page.goto('/benchmarks');
    const group = page.getByRole('group', { name: 'Algoritmos clásicos por pares' });
    await expect(group.locator('svg.recharts-surface')).toBeVisible();
    const curves = group.locator('.benchmark-series .recharts-line-curve');
    const legend = page
      .getByRole('list', { name: 'Leyenda de series' })
      .first()
      .getByRole('button', { name: 'jaccard' });

    await legend.focus();
    await expect(curves.nth(2)).toHaveAttribute('stroke-width', '2.25');
    await expect(curves.nth(0)).toHaveAttribute('stroke-opacity', '0.12');

    await legend.blur();
    await expect(curves.nth(0)).toHaveAttribute('stroke-opacity', '1');
  });

  test('the scale change fades the gridlines in, and does nothing under reduced motion', async ({
    page,
  }) => {
    const animationNameOfGrid = () =>
      page
        .getByRole('group', { name: 'Algoritmos clásicos por pares' })
        .locator('.recharts-cartesian-grid')
        .first()
        .evaluate((element) => {
          const win = globalThis as unknown as {
            getComputedStyle: (node: unknown) => { animationName: string };
          };
          return win.getComputedStyle(element).animationName;
        });

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/benchmarks');
    await expect(page.getByRole('group', { name: 'Algoritmos clásicos por pares' })).toBeVisible();
    await page
      .getByRole('radiogroup', { name: 'Escala' })
      .getByRole('radio', { name: 'Log–log' })
      .click();
    await expect.poll(animationNameOfGrid).toBe('fade');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page
      .getByRole('radiogroup', { name: 'Escala' })
      .getByRole('radio', { name: 'Lineal' })
      .click();
    await expect.poll(animationNameOfGrid).toBe('none');
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the benchmarks screen', async ({
    page,
  }) => {
    await page.goto('/benchmarks');

    await expect(
      page.getByRole('heading', { name: 'Benchmarks de rendimiento (JMH)' }),
    ).toBeVisible();
    await expect(page.getByTestId('embedding-tile-1536')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('has no automatically detectable WCAG 2.1 AA violations at 390px, where the family/exponent tables scroll horizontally', async ({
    page,
  }) => {
    // The default (1440-ish) viewport's own axe pass above never scrolls
    // any of these tables horizontally — this one reproduces the narrow
    // viewport where the family/slope table's own scroll container was
    // reported unreachable by keyboard (`scrollable-region-focusable`).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/benchmarks');

    await expect(
      page.getByRole('heading', { name: 'Benchmarks de rendimiento (JMH)' }),
    ).toBeVisible();
    await expect(page.getByTestId('embedding-tile-1536')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
