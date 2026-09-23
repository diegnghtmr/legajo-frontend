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

  it('shows only the n = 20 SLO result per family (TRD NFR-QA-01/02 fixed n)', () => {
    render(
      <SloSection
        results={[
          result({ family: 'slo-classic-levenshtein', size: 10, score: 999 }),
          result({ family: 'slo-classic-levenshtein', size: 20, score: 11.6 }),
        ]}
      />,
    );

    const classicTable = screen.getByRole('table', { name: /NFR-QA-01/ });
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

    const classicTable = screen.getByRole('table', { name: /NFR-QA-01/ });
    expect(within(classicTable).getAllByRole('row')).toHaveLength(3);
  });

  it('marks a result exactly at the threshold as exceeding, not within (TAC-07 "< 5 s"/"< 1 s")', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 5_000 })]} />);

    expect(screen.getByText('Excede el umbral')).toBeInTheDocument();
  });

  it('labels an exceeded NFR-QA-02 clustering threshold in text', () => {
    render(<SloSection results={[result({ family: 'slo-clustering', score: 1_500 })]} />);

    const clusteringTable = screen.getByRole('table', { name: /NFR-QA-02/ });
    expect(within(clusteringTable).getByText('Excede el umbral')).toBeInTheDocument();
  });

  it('shows the measured and threshold values formatted as durations', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 11.6 })]} />);

    const classicTable = screen.getByRole('table', { name: /NFR-QA-01/ });
    expect(within(classicTable).getByText('11.6 ms')).toBeInTheDocument();
    expect(within(classicTable).getByText('5 s')).toBeInTheDocument();
  });

  it('shows NFR-QA-01 per classic algorithm, each within its 5 s threshold', () => {
    render(<SloSection results={RESULTS} />);

    const classicTable = screen.getByRole('table', { name: /NFR-QA-01/ });
    expect(within(classicTable).getByText('levenshtein')).toBeInTheDocument();
    expect(within(classicTable).getByText('needleman-wunsch')).toBeInTheDocument();
    expect(within(classicTable).getAllByText('Dentro del umbral')).toHaveLength(4);
    expect(within(classicTable).queryByText('Excede el umbral')).not.toBeInTheDocument();
  });

  it('shows NFR-QA-02 for the four linkages, within its 1 s threshold', () => {
    render(<SloSection results={RESULTS} />);

    const clusteringTable = screen.getByRole('table', { name: /NFR-QA-02/ });
    expect(within(clusteringTable).getByText('Dentro del umbral')).toBeInTheDocument();
  });

  it('labels an exceeded threshold in text, not color alone', () => {
    render(<SloSection results={[result({ family: 'slo-classic-levenshtein', score: 6_000 })]} />);

    const status = screen.getByText('Excede el umbral');
    expect(status).toBeInTheDocument();
    expect(status.className).toContain('text-danger');
  });

  it('omits a result with an unrecognized unit instead of throwing during render', () => {
    expect(() =>
      render(
        <SloSection results={[result({ family: 'slo-classic-levenshtein', unit: 'op/s' })]} />,
      ),
    ).not.toThrow();
  });
});
