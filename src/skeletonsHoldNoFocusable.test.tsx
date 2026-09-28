import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BenchmarkCurveChartSkeleton } from './features/benchmarks/BenchmarkCurveChart';
import { SloSectionSkeleton } from './features/benchmarks/SloSection';
import { ClusteringMetricsTableSkeleton } from './features/clustering/ClusteringMetricsTable';
import { MatrixTableSkeleton } from './features/similarity/matrix/MatrixTable';
import { TraceBodySkeleton } from './features/similarity/traces/TraceBodySkeleton';
import { focusableInSkeletons } from './test/skeletonFocus';

const TRACE_ALGORITHMS = [
  'levenshtein',
  'needleman-wunsch',
  'jaccard',
  'tfidf-cosine',
  'embedding-local',
  'embedding-api',
] as const;

describe('skeletons hold no focusable element', () => {
  for (const algorithmId of TRACE_ALGORITHMS) {
    it(`trace body, ${algorithmId}`, () => {
      const { container } = render(<TraceBodySkeleton algorithmId={algorithmId} />);
      expect(focusableInSkeletons(container)).toEqual([]);
    });
  }

  it('clustering metrics table', () => {
    const { container } = render(
      <ClusteringMetricsTableSkeleton
        linkageIds={['single', 'complete', 'average', 'ward']}
        representation="tfidf-cosine"
        sampleSizeEstimate={20}
      />,
    );
    expect(focusableInSkeletons(container)).toEqual([]);
  });

  it('similarity matrix', () => {
    const { container } = render(<MatrixTableSkeleton documentCount={5} />);
    expect(focusableInSkeletons(container)).toEqual([]);
  });

  it('benchmark service-level tables', () => {
    const { container } = render(<SloSectionSkeleton />);
    expect(focusableInSkeletons(container)).toEqual([]);
  });

  it('benchmark curve chart', () => {
    const { container } = render(
      <BenchmarkCurveChartSkeleton
        title="Comparaciones por pares"
        xAxisLabel="Longitud (caracteres)"
        yAxisLabel="Tiempo (ns)"
        slopeTableCaption="Pendiente log–log"
        families={['levenshtein', 'jaccard']}
      />,
    );
    expect(focusableInSkeletons(container)).toEqual([]);
  });
});
