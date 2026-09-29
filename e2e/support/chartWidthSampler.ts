import type { Page } from '@playwright/test';

/** One animation frame's measurement of one chart. `box` is the element that
 * hands the chart its width; `svg` is the drawn surface, or `null` while the
 * box exists but nothing is drawn yet. */
export interface ChartFrame {
  frame: number;
  box: number;
  svg: number | null;
}

export type ChartTimelines = Record<string, ChartFrame[]>;

/**
 * Runs in the page from the very first script: on every `requestAnimationFrame`
 * it measures each chart box (the benchmark chart's group, the dendrogram
 * card's measured container) and the svg drawn inside it, so the timeline
 * covers every painted frame from navigation on, not only the settled state.
 * Kept as a string because the e2e project has no DOM typings.
 */
const SAMPLER_SCRIPT = `
(() => {
  const timelines = {};
  const ids = new WeakMap();
  let frame = 0;
  let nextId = 0;
  function boxes() {
    const found = [...document.querySelectorAll('[role="group"][data-scale]')];
    for (const card of document.querySelectorAll(
      '[data-testid^="linkage-dendrogram-"]:not([data-testid*="skeleton"])',
    )) {
      const chart = card.querySelector('svg[role="img"]');
      if (chart) {
        found.push(chart.parentElement);
      } else {
        const measured = card.querySelector('.mt-3');
        if (measured) found.push(measured);
      }
    }
    return found;
  }
  function tick() {
    frame += 1;
    for (const box of boxes()) {
      if (!ids.has(box)) ids.set(box, 'chart-' + nextId++);
      const id = ids.get(box);
      const svg = box.querySelector('svg.recharts-surface, svg[role="img"]');
      (timelines[id] ??= []).push({
        frame,
        box: box.getBoundingClientRect().width,
        svg: svg ? svg.getBoundingClientRect().width : null,
      });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__chartTimelines = timelines;
})();
`;

export async function installChartWidthSampler(page: Page): Promise<void> {
  await page.addInitScript(SAMPLER_SCRIPT);
}

export async function readChartTimelines(page: Page): Promise<ChartTimelines> {
  return page.evaluate(
    () => (globalThis as unknown as { __chartTimelines: ChartTimelines }).__chartTimelines,
  );
}

/** The distinct consecutive svg widths a chart was painted at, in order. */
export function paintedWidths(frames: readonly ChartFrame[]): number[] {
  const widths: number[] = [];
  for (const { svg } of frames) {
    if (svg === null) continue;
    const rounded = Math.round(svg * 10) / 10;
    if (widths[widths.length - 1] !== rounded) widths.push(rounded);
  }
  return widths;
}
