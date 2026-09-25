import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ClusteringResponse } from '../../infrastructure/api/clustering';
import type { LinkageId } from '../../infrastructure/schemas/clustering';
import { ClusteringMetricsTable } from './ClusteringMetricsTable';
import type { ClusteringRankingResult } from './ranking';

function linkageResult(
  linkageId: LinkageId,
  cophenetic: number,
  meanSilhouette: Record<string, number>,
  daviesBouldin: Record<string, number | null>,
): ClusteringResponse[number] {
  return {
    linkageId,
    linkageDisplayName: linkageId[0]!.toUpperCase() + linkageId.slice(1),
    rows: [],
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
    evaluation: { cophenetic, meanSilhouette, daviesBouldin },
  };
}

const KEYS = { '2': 0.15, '3': 0.25, '4': 0, '5': 0.35 };

function results(overrides: Partial<Record<LinkageId, number[]>> = {}): ClusteringResponse {
  const [singleCoph, singleSil, singleDb] = overrides.single ?? [0.95, 0.2, 0.5];
  const [completeCoph, completeSil, completeDb] = overrides.complete ?? [0.5, 0.9, 0.1];
  const [averageCoph, averageSil, averageDb] = overrides.average ?? [0.4, 0.3, 0.2];
  const [wardCoph, wardSil, wardDb] = overrides.ward ?? [0.3, 0.1, null as unknown as number];

  return [
    linkageResult('single', singleCoph!, { ...KEYS, '4': singleSil! }, { ...KEYS, '4': singleDb! }),
    linkageResult(
      'complete',
      completeCoph!,
      { ...KEYS, '4': completeSil! },
      { ...KEYS, '4': completeDb! },
    ),
    linkageResult(
      'average',
      averageCoph!,
      { ...KEYS, '4': averageSil! },
      { ...KEYS, '4': averageDb! },
    ),
    linkageResult('ward', wardCoph!, { ...KEYS, '4': wardSil! }, { ...KEYS, '4': wardDb ?? null }),
  ];
}

/** single: sole cophenetic leader; complete: sole silhouette leader at k_ref=4 -> leaders differ. */
const DIFFERING_RANKING: ClusteringRankingResult = {
  copheneticTieSet: ['single'],
  bestTreeFidelity: 'single',
  bestPartitionAtKRef: 'complete',
  leadersDiffer: true,
};

describe('ClusteringMetricsTable', () => {
  it('renders one row per linkage, in the fixed declaration order regardless of input order', () => {
    const reversed = [...results()].reverse();

    render(
      <ClusteringMetricsTable
        results={reversed}
        kRef={4}
        ranking={DIFFERING_RANKING}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1); // drop the header row
    const order = rows.map((row) => row.getAttribute('data-testid'));
    expect(order).toEqual([
      'metrics-row-single',
      'metrics-row-complete',
      'metrics-row-average',
      'metrics-row-ward',
    ]);
  });

  it('shows the cophenetic, silhouette at k_ref and Davies-Bouldin at k_ref values for each row', () => {
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={DIFFERING_RANKING}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    // formatMetricValue's own 4-decimal convention (formatMetricValue.ts).
    const singleRow = screen.getByTestId('metrics-row-single');
    expect(within(singleRow).getByText('0.9500')).toBeInTheDocument();
    expect(within(singleRow).getByText('0.2000')).toBeInTheDocument();
    expect(within(singleRow).getByText('0.5000')).toBeInTheDocument();
  });

  it('marks the tree fidelity and partition leaders with their own eyebrows when they differ', () => {
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={DIFFERING_RANKING}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    expect(within(screen.getByTestId('metrics-row-single')).getByText('Árbol')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('metrics-row-complete')).getByText('Partición'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Líder')).not.toBeInTheDocument();
  });

  it('marks the single generic leader when the tree and partition leaders coincide', () => {
    const sameLeaderRanking: ClusteringRankingResult = {
      copheneticTieSet: ['single'],
      bestTreeFidelity: 'single',
      bestPartitionAtKRef: 'single',
      leadersDiffer: false,
    };

    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={sameLeaderRanking}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    expect(within(screen.getByTestId('metrics-row-single')).getByText('Líder')).toBeInTheDocument();
    expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
    expect(screen.queryByText('Partición')).not.toBeInTheDocument();
  });

  it('shows "no definido" for a null Davies-Bouldin value at k_ref', () => {
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={DIFFERING_RANKING}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    expect(
      within(screen.getByTestId('metrics-row-ward')).getByText('no definido'),
    ).toBeInTheDocument();
  });

  it('renders the secondary columns for every fixed k other than k_ref, with their values', () => {
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={DIFFERING_RANKING}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    expect(screen.getByText('Silueta media (k=2)')).toBeInTheDocument();
    expect(screen.getByText('Silueta media (k=3)')).toBeInTheDocument();
    expect(screen.getByText('Silueta media (k=5)')).toBeInTheDocument();
    // k_ref (4) has its own lead column only, not a second, duplicate
    // secondary column repeating the exact same header text.
    expect(screen.getAllByText('Silueta media (k=4)')).toHaveLength(1);

    // 0.15 appears twice on this row (silhouette and Davies-Bouldin at
    // k=2 share the same fixture value) -- both cells render it.
    const singleRow = screen.getByTestId('metrics-row-single');
    expect(within(singleRow).getAllByText('0.1500')).toHaveLength(2);
  });

  it('shows the cophenetic tie set sentence when it has more than one member', () => {
    const tieRanking: ClusteringRankingResult = {
      copheneticTieSet: ['single', 'complete', 'ward'],
      bestTreeFidelity: 'single',
      bestPartitionAtKRef: 'complete',
      leadersDiffer: true,
    };

    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={tieRanking}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    expect(screen.getByText(/single, complete, ward/)).toBeInTheDocument();
  });

  it('shows the "requires all four" explanation and no eyebrows when ranking is undefined', () => {
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={undefined}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    expect(
      screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
    expect(screen.queryByText('Partición')).not.toBeInTheDocument();
    expect(screen.queryByText('Líder')).not.toBeInTheDocument();
  });

  it('renders no table, but still shows the requires-all-four explanation, when k_ref cannot be resolved (linkages disagree on n)', () => {
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={undefined}
        ranking={undefined}
        representation="tfidf-cosine"
        sampleSize={undefined}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
    ).toBeInTheDocument();
  });

  it('omits the sample-size caveat line when the sample size is undefined', () => {
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={undefined}
        ranking={undefined}
        representation="tfidf-cosine"
        sampleSize={undefined}
      />,
    );

    expect(screen.queryByText(/n = /)).not.toBeInTheDocument();
  });

  it('shows the representation, distance-basis and sample-size caveat line', () => {
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={DIFFERING_RANKING}
        representation="tfidf-cosine"
        sampleSize={6}
      />,
    );

    expect(screen.getByText(/n = 6/)).toBeInTheDocument();
  });
});
