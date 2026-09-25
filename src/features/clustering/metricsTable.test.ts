import { describe, expect, it } from 'vitest';

import type { LinkageId } from '../../infrastructure/schemas/clustering';
import { orderLinkagesForMetricsTable, secondaryFixedKColumns } from './metricsTable';

function evaluationWithKeys(meanSilhouetteKeys: readonly string[]): {
  cophenetic: number;
  meanSilhouette: Record<string, number>;
  daviesBouldin: Record<string, number | null>;
} {
  const meanSilhouette: Record<string, number> = {};
  const daviesBouldin: Record<string, number | null> = {};
  for (const key of meanSilhouetteKeys) {
    meanSilhouette[key] = 0.5;
    daviesBouldin[key] = 0.5;
  }
  return { cophenetic: 0.9, meanSilhouette, daviesBouldin };
}

describe('orderLinkagesForMetricsTable', () => {
  it('sorts an already-ordered response into the fixed declaration order (no-op)', () => {
    const input = ['single', 'complete', 'average', 'ward'].map((linkageId) => ({
      linkageId: linkageId as LinkageId,
    }));

    expect(orderLinkagesForMetricsTable(input).map((r) => r.linkageId)).toEqual([
      'single',
      'complete',
      'average',
      'ward',
    ]);
  });

  it('reorders a reversed response into the fixed declaration order', () => {
    const input = ['ward', 'average', 'complete', 'single'].map((linkageId) => ({
      linkageId: linkageId as LinkageId,
    }));

    expect(orderLinkagesForMetricsTable(input).map((r) => r.linkageId)).toEqual([
      'single',
      'complete',
      'average',
      'ward',
    ]);
  });

  it('reorders a partial response (fewer than four linkages) the same way', () => {
    const input = ['ward', 'single'].map((linkageId) => ({ linkageId: linkageId as LinkageId }));

    expect(orderLinkagesForMetricsTable(input).map((r) => r.linkageId)).toEqual(['single', 'ward']);
  });
});

describe('secondaryFixedKColumns', () => {
  it('returns every fixed k other than k_ref, ascending', () => {
    const results = [{ evaluation: evaluationWithKeys(['2', '3', '4', '5']) }];

    expect(secondaryFixedKColumns(results, 4)).toEqual([2, 3, 5]);
  });

  it('unions keys across every linkage, so one linkage missing a key never narrows the columns', () => {
    const results = [
      { evaluation: evaluationWithKeys(['2', '3', '4']) },
      { evaluation: evaluationWithKeys(['2', '3', '4', '5']) },
    ];

    expect(secondaryFixedKColumns(results, 4)).toEqual([2, 3, 5]);
  });

  it('sorts numerically, not lexicographically (2 before 10)', () => {
    const results = [{ evaluation: evaluationWithKeys(['2', '4', '10']) }];

    expect(secondaryFixedKColumns(results, 4)).toEqual([2, 10]);
  });

  it('returns an empty array when the only fixed k is k_ref itself', () => {
    const results = [{ evaluation: evaluationWithKeys(['2']) }];

    expect(secondaryFixedKColumns(results, 2)).toEqual([]);
  });
});
