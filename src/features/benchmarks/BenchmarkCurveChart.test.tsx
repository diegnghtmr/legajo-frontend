import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BenchmarkCurveChart } from './BenchmarkCurveChart';
import type { FamilySeries } from './grouping';
import { dashPatternForIndex } from './seriesStyle';

const SERIES: FamilySeries[] = [
  {
    family: 'levenshtein',
    points: [
      { size: 50, valueNs: 7_900 },
      { size: 100, valueNs: 29_600 },
    ],
  },
  {
    family: 'jaccard',
    points: [
      { size: 50, valueNs: 4_500 },
      { size: 100, valueNs: 20_300 },
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

  it('draws each series with a distinct marker shape (grayscale, not color-only)', () => {
    const { container } = renderChart();

    expect(container.querySelectorAll('[data-shape="circle"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-shape="square"]').length).toBeGreaterThan(0);
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
    expect(dataTable.className).toContain('sr-only');
    expect(within(dataTable).getByText('7.9 µs')).toBeInTheDocument();
    expect(within(dataTable).getByText('29.6 µs')).toBeInTheDocument();
    expect(within(dataTable).getByText('4.5 µs')).toBeInTheDocument();
    expect(within(dataTable).getByText('20.3 µs')).toBeInTheDocument();
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
          { size: 0, valueNs: 100 },
          { size: 50, valueNs: 7_900 },
          { size: 100, valueNs: 29_600 },
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

    const theoreticalPaths = document.querySelectorAll('path[stroke="var(--color-ink-muted)"]');
    expect(theoreticalPaths).toHaveLength(1);

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
    expect(screen.queryByRole('group', { name: 'Empty group' })).not.toBeInTheDocument();
  });

  it('gives a missing value in the sr-only data table accessible text instead of an empty cell', () => {
    const seriesWithGap: FamilySeries[] = [
      {
        family: 'levenshtein',
        points: [{ size: 50, valueNs: 7_900 }],
      },
      {
        family: 'jaccard',
        points: [
          { size: 50, valueNs: 4_500 },
          { size: 100, valueNs: 20_300 },
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
    expect(items).toHaveLength(SERIES.length);
    for (const series of SERIES) {
      const label = within(legend).getByText(series.family);
      expect(label.className).toContain('font-mono');
    }
  });

  it("matches each legend swatch's dash pattern to its series' own line style, in grayscale ink", () => {
    const { container } = renderChart();

    SERIES.forEach((series, index) => {
      const swatch = container.querySelector(`[data-testid="legend-dash-${series.family}"]`);
      expect(swatch).not.toBeNull();
      expect(swatch).toHaveAttribute('stroke', 'var(--color-ink)');
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
});
