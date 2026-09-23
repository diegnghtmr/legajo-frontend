import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BenchmarkCurveChart } from './BenchmarkCurveChart';
import type { FamilySeries } from './grouping';

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
});
