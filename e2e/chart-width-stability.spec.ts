import { expect, test, type Page } from '@playwright/test';

import {
  installChartWidthSampler,
  paintedWidths,
  readChartTimelines,
  type ChartTimelines,
} from './support/chartWidthSampler.js';
import { loadFixture } from './support/fixtures.js';

/**
 * A chart must never be painted at one width and then resized: from the
 * first frame that draws it, its width is the settled width and stays there.
 * Every animation frame from navigation until well after the data renders is
 * sampled; the recorded width sequence per chart must be a single value.
 *
 * Classic (space-taking) scrollbars are restored for this spec: Playwright's
 * headless Chromium hides them, but a real desktop browser shows one once the
 * page grows past the viewport, and that changes the width a chart measures.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const CORPUS = loadFixture<unknown>('corpus.json');
const BENCHMARK_REPORT = loadFixture<unknown>('benchmarks.json');
const CLUSTERING_RESPONSE = loadFixture<unknown>('clustering-default.json');

const SETTLE_AFTER_DATA_MS = 1500;
const TOLERANCE_PX = 1;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 900 },
  { width: 390, height: 844 },
] as const;

const SCREENS = [
  { path: '/benchmarks', ready: 'benchmark-chart-row', charts: 3 },
  { path: '/clustering', ready: 'linkage-dendrogram-single', charts: 4 },
] as const;

function expectSingleSettledWidth(timelines: ChartTimelines, expectedCharts: number) {
  const ids = Object.keys(timelines);
  expect(ids.length, 'charts sampled').toBeGreaterThanOrEqual(expectedCharts);
  for (const id of ids) {
    const frames = timelines[id]!;
    const widths = paintedWidths(frames);
    const settled = widths[widths.length - 1]!;
    expect(widths.length, `${id} painted widths: ${JSON.stringify(widths)}`).toBeGreaterThan(0);
    for (const width of widths) {
      expect(
        Math.abs(width - settled),
        `${id} painted widths: ${JSON.stringify(widths)}`,
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    }
  }
}

async function mockApi(page: Page) {
  await page.route('**/api/v1/corpus', (route) => route.fulfill({ json: CORPUS }));
  await page.route('**/api/v1/benchmarks', (route) => route.fulfill({ json: BENCHMARK_REPORT }));
  await page.route('**/api/v1/clustering', (route) => route.fulfill({ json: CLUSTERING_RESPONSE }));
}

/** Follows a top-bar link client-side; below `lg` the links sit behind the
 * navigation toggle. */
async function goToSection(page: Page, path: string) {
  const link = page.locator(`a[href="${path}"]`).first();
  if (!(await link.isVisible())) {
    await page.getByRole('button', { name: 'Abrir navegación' }).click();
  }
  await link.click();
}

/** Width the page gives up to a classic scrollbar (0 when it is an overlay). */
function scrollbarWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { clientWidth: number } };
    };
    return root.innerWidth - root.document.documentElement.clientWidth;
  });
}

for (const viewport of VIEWPORTS) {
  test(`client-side navigation back to cached charts at ${viewport.width}px paints them at their settled width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mockApi(page);
    await installChartWidthSampler(page);

    await page.goto('/benchmarks');
    await expect(page.getByTestId('benchmark-chart-row').first()).toBeVisible();
    await goToSection(page, '/clustering');
    await expect(page.getByTestId('linkage-dendrogram-single')).toBeVisible();
    await page.evaluate(() => {
      const timelines = (globalThis as unknown as { __chartTimelines: Record<string, unknown> })
        .__chartTimelines;
      for (const id of Object.keys(timelines)) delete timelines[id];
    });
    await goToSection(page, '/benchmarks');
    await expect(page.getByTestId('benchmark-chart-row').first()).toBeVisible();
    await page.waitForTimeout(SETTLE_AFTER_DATA_MS);

    expectSingleSettledWidth(await readChartTimelines(page), 3);
  });

  for (const screen of SCREENS) {
    test(`${screen.path} at ${viewport.width}px paints every chart at its settled width from the first frame`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockApi(page);
      await installChartWidthSampler(page);

      await page.goto(screen.path);
      await expect(page.getByTestId(screen.ready).first()).toBeVisible();
      await page.waitForTimeout(SETTLE_AFTER_DATA_MS);

      expect(await scrollbarWidth(page), 'classic scrollbar width').toBeGreaterThan(0);
      const timelines = await readChartTimelines(page);
      console.log(
        `${screen.path} @${viewport.width}: ` +
          JSON.stringify(
            Object.fromEntries(
              Object.entries(timelines).map(([id, frames]) => [id, paintedWidths(frames)]),
            ),
          ),
      );
      expectSingleSettledWidth(timelines, screen.charts);
    });
  }
}
