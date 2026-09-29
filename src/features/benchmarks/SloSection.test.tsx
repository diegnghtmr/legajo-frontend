import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { SloSection } from './SloSection';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

function result(overrides: Partial<BenchmarkResult>): BenchmarkResult {
  return {
    benchmark: 'x',
    family: 'slo-classic-levenshtein',
    parameter: 'n',
    size: 20,
    score: 11.6,
    error: 1,
    unit: 'ms/op',
    ...overrides,
  };
}

const RESULTS: BenchmarkResult[] = [
  result({ family: 'slo-classic-levenshtein', score: 11.6 }),
  result({ family: 'slo-classic-needleman-wunsch', score: 11.7 }),
  result({ family: 'slo-classic-jaccard', score: 7.1 }),
  result({ family: 'slo-classic-tfidf-cosine', score: 7.2 }),
  result({ family: 'slo-clustering', score: 0.017 }),
];

describe('SloSection', () => {
  it('renders nothing when there are no SLO results', () => {
    const { container } = render(<SloSection results={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only the n = 20 SLO result per family (fixed n)', () => {
    render(
      <SloSection
        results={[
          result({ family: 'slo-classic-levenshtein', size: 10, score: 999 }),
          result({ family: 'slo-classic-levenshtein', size: 20, score: 11.6 }),
        ]}
      />,
    );

    const classicTable = screen.getByRole('table', { name: /clásicas por pares/ });
    expect(within(classicTable).getAllByText('levenshtein')).toHaveLength(1);
    expect(within(classicTable).getByText('11.6 ms')).toBeInTheDocument();
  });

  it('keys each row uniquely by family and size', () => {
    render(
      <SloSection
        results={[
          result({ family: 'slo-classic-levenshtein', size: 20, score: 11.6 }),
          result({ family: 'slo-classic-needleman-wunsch', size: 20, score: 11.7 }),
        ]}
      />,
    );

    const classicTable = screen.getByRole('table', { name: /clásicas por pares/ });
    expect(within(classicTable).getAllByRole('row')).toHaveLength(3);
  });

  it('marks a result exactly at the threshold as exceeding, not within ("< 5 s"/"< 1 s")', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 5_000 })]} />);

    expect(screen.getByText('excede')).toBeInTheDocument();
  });

  it('labels an exceeded clustering threshold in text', () => {
    render(<SloSection results={[result({ family: 'slo-clustering', score: 1_500 })]} />);

    const clusteringTable = screen.getByRole('table', { name: /cuatro enlaces/ });
    expect(within(clusteringTable).getByText('excede')).toBeInTheDocument();
  });

  it('shows the measured and threshold values formatted as durations', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 11.6 })]} />);

    const classicTable = screen.getByRole('table', { name: /clásicas por pares/ });
    expect(within(classicTable).getByText('11.6 ms')).toBeInTheDocument();
    expect(within(classicTable).getByText('5 s')).toBeInTheDocument();
  });

  it('shows the classic SLO table per classic algorithm, each within its 5 s threshold', () => {
    render(<SloSection results={RESULTS} />);

    const classicTable = screen.getByRole('table', { name: /clásicas por pares/ });
    expect(within(classicTable).getByText('levenshtein')).toBeInTheDocument();
    expect(within(classicTable).getByText('needleman-wunsch')).toBeInTheDocument();
    expect(within(classicTable).getAllByText(/^dentro \(/)).toHaveLength(4);
    expect(within(classicTable).queryByText('excede')).not.toBeInTheDocument();
  });

  it('shows the clustering SLO table for the four linkages, within its 1 s threshold', () => {
    render(<SloSection results={RESULTS} />);

    const clusteringTable = screen.getByRole('table', { name: /cuatro enlaces/ });
    expect(within(clusteringTable).getByText('dentro (58824×)')).toBeInTheDocument();
  });

  it('labels an exceeded threshold in text, not color alone', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 6_000 })]} />);

    const status = screen.getByText('excede');
    expect(status).toBeInTheDocument();
    expect(status.closest('[data-status]')?.className).toContain('text-danger');
  });

  it('omits a result with an unrecognized unit instead of throwing during render', () => {
    expect(() =>
      render(
        <SloSection results={[result({ family: 'slo-classic-levenshtein', unit: 'op/s' })]} />,
      ),
    ).not.toThrow();
  });

  it('states the headroom factor in the within status, one decimal below 10 and whole from 10', () => {
    render(
      <SloSection
        results={[
          result({ family: 'slo-classic-levenshtein', score: 11.6 }),
          result({ family: 'slo-classic-jaccard', score: 1_250 }),
        ]}
      />,
    );

    const classicTable = screen.getByRole('table', { name: /clásicas por pares/ });
    expect(within(classicTable).getByText('dentro (431×)')).toBeInTheDocument();
    expect(within(classicTable).getByText('dentro (4.0×)')).toBeInTheDocument();
  });

  it('gives the status a shape as well as text and colour, hidden from assistive tech', () => {
    render(
      <SloSection
        results={[
          result({ family: 'slo-classic-levenshtein', score: 11.6 }),
          result({ family: 'slo-classic-jaccard', score: 6_000 }),
        ]}
      />,
    );

    const within_ = screen.getByText('dentro (431×)').closest('[data-status]')!;
    const exceeds = screen.getByText('excede').closest('[data-status]')!;
    expect(within_.className).toContain('text-success');
    expect(within_.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(exceeds.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within_.querySelector('svg')?.innerHTML).not.toBe(
      exceeds.querySelector('svg')?.innerHTML,
    );
  });

  it('draws a log bar filled in success up to the measurement, with an ink tick at the threshold', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 11.6 })]} />);

    const fill = screen.getByTestId('slo-fill-levenshtein');
    // 1 µs to 5 s is 6.7 decades; 11.6 ms sits 4.06 decades along.
    const expected =
      (Math.log10(11.6) - Math.log10(0.001)) / (Math.log10(5_000) - Math.log10(0.001));
    expect(fill.className).toContain('bg-success');
    expect(fill.style.width).toBe(`${expected * 100}%`);
    expect(screen.getByTestId('slo-threshold-levenshtein').className).toContain('bg-ink');
  });

  it('fills the whole track in danger when the measurement exceeds the threshold', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 6_000 })]} />);

    const fill = screen.getByTestId('slo-fill-levenshtein');
    expect(fill.className).toContain('bg-danger');
    expect(fill.style.width).toBe('100%');
  });

  it('keeps the drawn bar out of the accessibility tree, since the values are stated as text', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 11.6 })]} />);

    expect(
      screen.getByTestId('slo-fill-levenshtein').closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it('explains the scale and the factor in a subtitle under one section heading', () => {
    render(<SloSection results={RESULTS} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Objetivos de rendimiento (SLO)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/escala log/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /clásicas por pares/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /cuatro enlaces/ })).toBeInTheDocument();
  });
});
