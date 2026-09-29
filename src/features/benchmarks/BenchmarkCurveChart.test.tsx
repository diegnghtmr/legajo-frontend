import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubLaidOutWidth } from '../../test/layout';

import {
  BenchmarkCurveChart,
  BenchmarkCurveChartSkeleton,
  CHART_HEIGHT,
} from './BenchmarkCurveChart';
import type { FamilySeries } from './grouping';
import { dashPatternForIndex, hueForIndex } from './seriesStyle';

/**
 * A controllable fake, installed per test via `vi.stubGlobal` — the same
 * pattern `useElementWidth`'s own test and `DendrogramCard.test.tsx` use:
 * jsdom's own default `ResizeObserver` stub never fires a callback, so a
 * test that needs to observe a real resize installs this instead.
 */
class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}

  trigger(width: number): void {
    this.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

beforeEach(() => {
  stubLaidOutWidth(640);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeResizeObserver.instances = [];
});

const SERIES: FamilySeries[] = [
  {
    family: 'levenshtein',
    points: [
      { size: 50, valueNs: 7_900, errorNs: 400 },
      { size: 100, valueNs: 29_600, errorNs: 1_200 },
    ],
  },
  {
    family: 'jaccard',
    points: [
      { size: 50, valueNs: 4_500, errorNs: 0 },
      { size: 100, valueNs: 20_300, errorNs: 500 },
    ],
  },
];

const SLOPES = new Map([
  ['levenshtein', { empiricalSlope: 2.039288, theoreticalExponent: 2 }],
  ['jaccard', { empiricalSlope: 1.47887, theoreticalExponent: 1 }],
]);

function renderChart(scale: 'linear' | 'log-log' = 'linear') {
  return render(
    <BenchmarkCurveChart
      title="Algoritmos clásicos por pares"
      xAxisLabel="Longitud de secuencia (L)"
      yAxisLabel="Tiempo"
      series={SERIES}
      slopes={SLOPES}
      scale={scale}
      dataTableCaption="Valores medidos: pares clásicos"
      slopeTableCaption="Pendiente log–log: pares clásicos"
    />,
  );
}

describe('BenchmarkCurveChart', () => {
  it('renders the chart title as a heading and an accessible chart region', () => {
    renderChart();

    expect(
      screen.getByRole('heading', { name: 'Algoritmos clásicos por pares' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Algoritmos clásicos por pares' }),
    ).toBeInTheDocument();
  });

  it('draws each series with a distinct marker shape (never colour alone)', () => {
    const { container } = renderChart();

    expect(container.querySelectorAll('[data-shape="circle"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-shape="square"]').length).toBeGreaterThan(0);
  });

  it('colours each series with its own cluster hue, in order, as a third channel', () => {
    const { container } = renderChart();

    const strokes = [...container.querySelectorAll('.benchmark-series .recharts-line-curve')].map(
      (curve) => curve.getAttribute('stroke'),
    );
    expect(strokes).toEqual(['var(--color-cluster-1)', 'var(--color-cluster-2)']);
    expect(container.querySelector('[data-shape="circle"]')?.getAttribute('fill')).toBe(
      'var(--color-cluster-1)',
    );
  });

  it('draws a ± error whisker on every point that reports a non-zero error, in the series hue', () => {
    const { container } = renderChart();

    // levenshtein: 2 points with error; jaccard: 1 (its size-50 error is zero).
    const whiskers = container.querySelectorAll('.recharts-errorBar');
    expect(whiskers).toHaveLength(3);
    expect(whiskers[0]).toHaveAttribute('stroke', 'var(--color-cluster-1)');
    expect(whiskers[0]).toHaveAttribute('stroke-opacity', '0.6');
    // The caps are 6px wide in total: the bar extends 3px to each side.
    const cap = whiskers[0]?.querySelector('line');
    expect(Number(cap?.getAttribute('x2')) - Number(cap?.getAttribute('x1'))).toBeCloseTo(6);
  });

  it('keeps the whiskers on the log-log scale', () => {
    const { container } = renderChart('log-log');

    expect(container.querySelectorAll('.recharts-errorBar')).toHaveLength(3);
  });

  it('isolates a series while its legend button is hovered or focused, then restores them all', () => {
    const { container } = renderChart();
    const curves = () =>
      [...container.querySelectorAll('.benchmark-series .recharts-line-curve')] as SVGElement[];

    const legend = screen.getByRole('list', { name: 'Leyenda de series' });
    const jaccardButton = within(legend).getByRole('button', { name: 'jaccard' });

    fireEvent.focus(jaccardButton);
    expect(curves().map((curve) => curve.getAttribute('stroke-opacity'))).toEqual(['0.12', '1']);
    expect(curves().map((curve) => curve.getAttribute('stroke-width'))).toEqual(['1.5', '2.25']);

    fireEvent.blur(jaccardButton);
    expect(curves().map((curve) => curve.getAttribute('stroke-opacity'))).toEqual(['1', '1']);

    fireEvent.mouseEnter(jaccardButton);
    expect(curves()[1]).toHaveAttribute('stroke-width', '2.25');
    fireEvent.mouseLeave(jaccardButton);
    expect(curves()[1]).toHaveAttribute('stroke-width', '1.5');
  });

  it('makes the legend items plain focusable buttons with no pressed state, since isolation is transient', () => {
    renderChart();

    const legend = screen.getByRole('list', { name: 'Leyenda de series' });
    const buttons = within(legend).getAllByRole('button');
    expect(buttons).toHaveLength(SERIES.length);
    for (const button of buttons) {
      expect(button).not.toHaveAttribute('aria-pressed');
      expect(button).toHaveAttribute('type', 'button');
    }
  });

  it('names the shared theoretical entry once in the legend, as text rather than a button', () => {
    renderChart();

    const legend = screen.getByRole('list', { name: 'Leyenda de series' });
    expect(within(legend).getByText('teórico')).toBeInTheDocument();
    expect(within(legend).queryByRole('button', { name: 'teórico' })).not.toBeInTheDocument();
  });

  it('shows a visible slope table with each family’s empirical slope vs theoretical exponent', () => {
    renderChart();

    const slopeTable = screen.getByRole('table', { name: 'Pendiente log–log: pares clásicos' });
    const rows = within(slopeTable).getAllByRole('row');
    // header + 2 families
    expect(rows).toHaveLength(3);
    expect(within(slopeTable).getByText('levenshtein')).toBeInTheDocument();
    expect(within(slopeTable).getByText('2.04')).toBeInTheDocument();
    expect(within(slopeTable).getByText('2.00')).toBeInTheDocument();
    expect(within(slopeTable).getByText('jaccard')).toBeInTheDocument();
    expect(within(slopeTable).getByText('1.48')).toBeInTheDocument();
  });

  it('exposes an sr-only data table with the raw measured values, per size', () => {
    renderChart();

    const dataTable = screen.getByRole('table', { name: 'Valores medidos: pares clásicos' });
    expect(within(dataTable).getByText('7.9 µs')).toBeInTheDocument();
    expect(within(dataTable).getByText('29.6 µs')).toBeInTheDocument();
    expect(within(dataTable).getByText('4.5 µs')).toBeInTheDocument();
    expect(within(dataTable).getByText('20.3 µs')).toBeInTheDocument();
  });

  it('wraps the sr-only data table in a plain div, never `sr-only` on the table element itself', () => {
    // A table generates two boxes — an anonymous "table wrapper box" that
    // takes `position`/`margin`, and the "table box" proper that takes
    // `width`/`height`/`overflow` — so `sr-only` directly on a `<table>`
    // clips only its grid of rows/cells, never its own `<TableCaption>`,
    // which sits in that unclipped wrapper box (verified against a live
    // render: the caption escaped at its own full wrapped size). Wrapping
    // the whole table in a plain `sr-only` div instead clips everything —
    // caption included — leaves the table itself an ordinary static,
    // in-flow element, and needs none of the previous `w-px`/`table-fixed`/
    // `whitespace-normal` hacks: this table's own `w-full` now resolves
    // against that div's own fixed 1px width (never the viewport, which is
    // what `w-full` resolved against when `sr-only` made the table itself
    // `position: absolute` with no `position: relative` ancestor).
    renderChart();

    const dataTable = screen.getByRole('table', { name: 'Valores medidos: pares clásicos' });
    expect(dataTable.className).not.toMatch(/sr-only/);
    const wrapper = dataTable.closest('.sr-only');
    expect(wrapper?.tagName).toBe('DIV');
    // `wrap={false}` on this `Table`: its own default scroll wrapper would
    // otherwise sit between this div and the table, which is unnecessary
    // once the outer div already does the only clipping this table needs.
    expect(wrapper).toBe(dataTable.parentElement);
  });

  it('renders without throwing on the log-log scale', () => {
    expect(() => renderChart('log-log')).not.toThrow();
  });

  it('exposes the active scale on the chart container', () => {
    const { container: linearContainer } = renderChart('linear');
    expect(linearContainer.querySelector('[role="group"]')).toHaveAttribute('data-scale', 'linear');

    const { container: logContainer } = renderChart('log-log');
    expect(logContainer.querySelector('[role="group"]')).toHaveAttribute('data-scale', 'log');
  });

  it('excludes non-positive points from the log-log plot while keeping them in the sr-only table', () => {
    const seriesWithNonPositive: FamilySeries[] = [
      {
        family: 'levenshtein',
        points: [
          { size: 0, valueNs: 100, errorNs: 0 },
          { size: 50, valueNs: 7_900, errorNs: 0 },
          { size: 100, valueNs: 29_600, errorNs: 0 },
        ],
      },
    ];

    const linear = render(
      <BenchmarkCurveChart
        title="Linear"
        xAxisLabel="L"
        yAxisLabel="T"
        series={seriesWithNonPositive}
        slopes={new Map()}
        scale="linear"
        dataTableCaption="linear-data"
        slopeTableCaption="linear-slope"
      />,
    );
    expect(linear.container.querySelectorAll('[data-shape="circle"]')).toHaveLength(3);
    linear.unmount();

    const logLog = render(
      <BenchmarkCurveChart
        title="LogLog"
        xAxisLabel="L"
        yAxisLabel="T"
        series={seriesWithNonPositive}
        slopes={new Map()}
        scale="log-log"
        dataTableCaption="loglog-data"
        slopeTableCaption="loglog-slope"
      />,
    );
    // The size = 0 point cannot be plotted on a log axis; the other two remain.
    expect(logLog.container.querySelectorAll('[data-shape="circle"]')).toHaveLength(2);

    const dataTable = screen.getByRole('table', { name: 'loglog-data' });
    expect(within(dataTable).getAllByRole('row')).toHaveLength(4); // header + all 3 raw points
    logLog.unmount();
  });

  it('overlays the dotted theoretical curve only for a family with a slope entry', () => {
    const slopesForLevenshteinOnly = new Map([
      ['levenshtein', { empiricalSlope: 2.04, theoreticalExponent: 2 }],
    ]);

    render(
      <BenchmarkCurveChart
        title="Mixed"
        xAxisLabel="L"
        yAxisLabel="T"
        series={SERIES}
        slopes={slopesForLevenshteinOnly}
        scale="linear"
        dataTableCaption="mixed-data"
        slopeTableCaption="mixed-slope"
      />,
    );

    const theoreticalPaths = document.querySelectorAll(
      '.benchmark-theoretical .recharts-line-curve',
    );
    expect(theoreticalPaths).toHaveLength(1);
    expect(theoreticalPaths[0]).toHaveAttribute('stroke', 'var(--color-cluster-1)');
    expect(theoreticalPaths[0]).toHaveAttribute('stroke-opacity', '0.45');

    const slopeTable = screen.getByRole('table', { name: 'mixed-slope' });
    expect(within(slopeTable).getAllByRole('row')).toHaveLength(2); // header + levenshtein only
    expect(within(slopeTable).getByText('levenshtein')).toBeInTheDocument();
    expect(within(slopeTable).queryByText('jaccard')).not.toBeInTheDocument();
  });

  it('shows a "no data" state instead of an empty chart when the group has no series', () => {
    render(
      <BenchmarkCurveChart
        title="Empty group"
        xAxisLabel="L"
        yAxisLabel="T"
        series={[]}
        slopes={new Map()}
        scale="linear"
        dataTableCaption="empty-data"
        slopeTableCaption="empty-slope"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Empty group' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No hay mediciones disponibles para este grupo.',
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-slot', 'empty-state');
    expect(screen.queryByRole('group', { name: 'Empty group' })).not.toBeInTheDocument();
  });

  it('gives a missing value in the sr-only data table accessible text instead of an empty cell', () => {
    const seriesWithGap: FamilySeries[] = [
      {
        family: 'levenshtein',
        points: [{ size: 50, valueNs: 7_900, errorNs: 0 }],
      },
      {
        family: 'jaccard',
        points: [
          { size: 50, valueNs: 4_500, errorNs: 0 },
          { size: 100, valueNs: 20_300, errorNs: 0 },
        ],
      },
    ];

    render(
      <BenchmarkCurveChart
        title="Gap"
        xAxisLabel="L"
        yAxisLabel="T"
        series={seriesWithGap}
        slopes={new Map()}
        scale="linear"
        dataTableCaption="gap-data"
        slopeTableCaption="gap-slope"
      />,
    );

    const dataTable = screen.getByRole('table', { name: 'gap-data' });
    const rows = within(dataTable).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + size 50 + size 100

    // levenshtein has no point at size 100: its cell must say so, never an empty cell.
    const size100Row = rows[2]!;
    expect(within(size100Row).getByText('100')).toBeInTheDocument();
    expect(within(size100Row).getByText('Sin dato')).toBeInTheDocument();
    expect(within(size100Row).getByText('20.3 µs')).toBeInTheDocument();
  });

  it('shows a visible legend naming each series by its mono algorithm id, readable by assistive tech', () => {
    renderChart();

    const legend = screen.getByRole('list', { name: 'Leyenda de series' });
    const items = within(legend).getAllByRole('listitem');
    // One entry per series plus the single shared "theoretical" entry.
    expect(items).toHaveLength(SERIES.length + 1);
    for (const series of SERIES) {
      const label = within(legend).getByText(series.family);
      expect(label.className).toContain('font-mono');
    }
  });

  it("matches each legend swatch's dash pattern and hue to its series' own line style", () => {
    const { container } = renderChart();

    SERIES.forEach((series, index) => {
      const swatch = container.querySelector(`[data-testid="legend-dash-${series.family}"]`);
      expect(swatch).not.toBeNull();
      expect(swatch).toHaveAttribute('stroke', hueForIndex(index));
      const expectedDash = dashPatternForIndex(index);
      if (expectedDash) {
        expect(swatch).toHaveAttribute('stroke-dasharray', expectedDash);
      } else {
        expect(swatch).not.toHaveAttribute('stroke-dasharray');
      }
    });
  });

  it('hides the legend swatches from assistive tech, since the visible mono label already names the series', () => {
    const { container } = renderChart();

    for (const series of SERIES) {
      const swatch = container.querySelector(`svg[data-testid="legend-swatch-${series.family}"]`);
      expect(swatch).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('shows no legend in the "no data" state', () => {
    render(
      <BenchmarkCurveChart
        title="Empty group"
        xAxisLabel="L"
        yAxisLabel="T"
        series={[]}
        slopes={new Map()}
        scale="linear"
        dataTableCaption="empty-data"
        slopeTableCaption="empty-slope"
      />,
    );

    expect(screen.queryByRole('list', { name: 'Leyenda de series' })).not.toBeInTheDocument();
  });

  it('draws nothing, in a box of its final height, while its width is still unknown', () => {
    vi.restoreAllMocks();

    const { container } = renderChart();

    expect(container.querySelector('svg.recharts-surface')).toBeNull();
    const group = screen.getByRole('group', { name: 'Algoritmos clásicos por pares' });
    expect((group.firstElementChild as HTMLElement).style.height).toBe(`${CHART_HEIGHT}px`);
  });

  it('draws at the measured width on its very first render, with no observer callback', () => {
    stubLaidOutWidth(900);

    const { container } = renderChart();

    expect(container.querySelector('svg.recharts-surface')?.getAttribute('width')).toBe('900');
  });

  it('fills its own measured container width instead of a fixed pixel width, once the container reports a wider measurement', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { container } = renderChart();
    const svgBefore = container.querySelector('svg.recharts-surface');
    expect(svgBefore).not.toBeNull();
    const widthBefore = Number(svgBefore?.getAttribute('width'));

    act(() => {
      FakeResizeObserver.instances[0]?.trigger(1200);
    });

    const svgAfter = container.querySelector('svg.recharts-surface');
    expect(Number(svgAfter?.getAttribute('width'))).toBeGreaterThan(widthBefore);
  });
});

describe('BenchmarkCurveChartSkeleton', () => {
  it('mirrors the real card past the chart itself: the x-axis label below it and the slope table region', () => {
    render(
      <BenchmarkCurveChartSkeleton
        title="Comparaciones por pares"
        xAxisLabel="Longitud (caracteres)"
        yAxisLabel="Tiempo (ns)"
        slopeTableCaption="Pendiente log–log: Comparaciones por pares"
        families={['levenshtein', 'needleman-wunsch', 'jaccard', 'tfidf-cosine']}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Comparaciones por pares' })).toBeInTheDocument();
    const chart = screen.getByTestId('benchmark-chart-skeleton');
    expect(chart.style.height).toBe(`${CHART_HEIGHT}px`);

    // The x-axis title is fixed chrome (never response data) — real text
    // immediately, in the same place the real card renders it below the
    // chart, not omitted from the skeleton.
    expect(screen.getByText('Longitud (caracteres)')).toBeInTheDocument();
    expect(screen.getByText('Tiempo (ns)')).toBeInTheDocument();

    // The legend already shows every fixed family id as real text (never
    // a generic bar a longer real id would then wrap past).
    const legend = screen.getByRole('list', { name: 'Leyenda de series' });
    expect(within(legend).getByText('needleman-wunsch')).toBeInTheDocument();

    // The slope table's own scroll region, one row per known family
    // (its own id as real text) — its real header labels are fixed
    // chrome too.
    const slopeRegion = screen.getByRole('table', { name: /pares/ }).parentElement!;
    expect(slopeRegion).toHaveClass('overflow-hidden');
    expect(slopeRegion).not.toHaveAttribute('tabindex');
    expect(within(slopeRegion).getByText('Familia')).toBeInTheDocument();
    expect(within(slopeRegion).getByText('Pendiente empírica')).toBeInTheDocument();
    expect(within(slopeRegion).getByText('Exponente teórico')).toBeInTheDocument();
    expect(within(slopeRegion).getByText('tfidf-cosine')).toBeInTheDocument();
    expect(within(slopeRegion).getAllByRole('row')).toHaveLength(1 + 4);
  });
});
