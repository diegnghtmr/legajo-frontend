import { describe, expect, it } from 'vitest';

import {
  COPHENETIC_TIE_TOLERANCE,
  hasCanonicalLinkageIds,
  kRefForSampleSize,
  metricsAtKRef,
  rankClusteringLinkages,
  sampleSizeFromResponse,
  type LinkageMetricsAtKRef,
} from './ranking';
import type { LinkageId } from '../../infrastructure/schemas/clustering';

function metric(
  linkageId: LinkageMetricsAtKRef['linkageId'],
  cophenetic: number,
  meanSilhouetteAtKRef: number,
  daviesBouldinAtKRef: number | null,
): LinkageMetricsAtKRef {
  return { linkageId, cophenetic, meanSilhouetteAtKRef, daviesBouldinAtKRef };
}

describe('rankClusteringLinkages — ported backend golden cases (ClusteringRankingTest.java)', () => {
  it('picks the sole cophenetic leader when there is no tie', () => {
    // single is alone at the top by more than 1e-3; complete has the highest
    // silhouette overall, so the two leaders differ and both are surfaced.
    const single = metric('single', 0.95, 0.2, 0.5);
    const complete = metric('complete', 0.5, 0.9, 0.1);
    const average = metric('average', 0.4, 0.3, 0.2);
    const ward = metric('ward', 0.3, 0.1, 0.6);

    const result = rankClusteringLinkages([single, complete, average, ward]);

    expect(result.copheneticTieSet).toEqual(['single']);
    expect(result.bestTreeFidelity).toBe('single');
    expect(result.bestPartitionAtKRef).toBe('complete');
    expect(result.leadersDiffer).toBe(true);
  });

  it('constructs a three-way tie and resolves it by mean silhouette', () => {
    // maxCophenetic = 0.9010 (complete). |0.9010 - x| <= 1e-3: single
    // (diff 5e-4) and ward (diff 2e-4) qualify; average (diff 0.101) does
    // not. Tie set = {single, complete, ward}; complete has the highest
    // silhouette (0.7) within it and overall, so the two leaders agree.
    const single = metric('single', 0.9005, 0.5, 0.3);
    const complete = metric('complete', 0.901, 0.7, 0.25);
    const average = metric('average', 0.8, 0.4, 0.2);
    const ward = metric('ward', 0.9008, 0.6, 0.28);

    const result = rankClusteringLinkages([single, complete, average, ward]);

    expect(result.copheneticTieSet).toEqual(['single', 'complete', 'ward']);
    expect(result.bestTreeFidelity).toBe('complete');
    expect(result.bestPartitionAtKRef).toBe('complete');
    expect(result.leadersDiffer).toBe(false);
  });

  it('resolves a tied silhouette by lowest Davies-Bouldin', () => {
    // single and complete tie exactly on correlation (0.9) and silhouette
    // (0.6); complete's lower DB (0.3 vs 0.5) breaks the tie.
    const single = metric('single', 0.9, 0.6, 0.5);
    const complete = metric('complete', 0.9, 0.6, 0.3);
    const average = metric('average', 0.5, 0.2, 0.4);
    const ward = metric('ward', 0.4, 0.1, 0.6);

    const result = rankClusteringLinkages([single, complete, average, ward]);

    expect(result.copheneticTieSet).toEqual(['single', 'complete']);
    expect(result.bestTreeFidelity).toBe('complete');
  });

  it('an undefined (null) Davies-Bouldin loses the tie-break to any defined value', () => {
    // single and complete are still tied on correlation and silhouette;
    // single's DB is undefined (null), so complete (a defined, finite DB)
    // wins — a null DB carries no evidence of a well-separated partition.
    const single = metric('single', 0.9, 0.6, null);
    const complete = metric('complete', 0.9, 0.6, 0.3);
    const average = metric('average', 0.5, 0.2, 0.4);
    const ward = metric('ward', 0.4, 0.1, 0.6);

    const result = rankClusteringLinkages([single, complete, average, ward]);

    expect(result.bestTreeFidelity).toBe('complete');
  });

  it('resolves a final tie by declaration order', () => {
    // single, complete and ward are all tied on correlation, silhouette and
    // DB (all null); average sits far below the correlation threshold.
    // Declaration order (single, complete, average, ward) makes single win.
    const single = metric('single', 0.9, 0.6, null);
    const complete = metric('complete', 0.9, 0.6, null);
    const average = metric('average', 0.5, 0.2, null);
    const ward = metric('ward', 0.9, 0.6, null);

    const result = rankClusteringLinkages([single, complete, average, ward]);

    expect(result.copheneticTieSet).toEqual(['single', 'complete', 'ward']);
    expect(result.bestTreeFidelity).toBe('single');
  });

  it('resolves the silhouette leader tie by declaration order too', () => {
    // complete and average tie for the highest silhouette (0.9) across all
    // four linkages (not just the cophenetic tie set); declaration order
    // (complete before average) is the deterministic fallback.
    const single = metric('single', 0.9, 0.5, null);
    const complete = metric('complete', 0.5, 0.9, null);
    const average = metric('average', 0.4, 0.9, null);
    const ward = metric('ward', 0.3, 0.1, null);

    const result = rankClusteringLinkages([single, complete, average, ward]);

    expect(result.bestPartitionAtKRef).toBe('complete');
  });

  it('rejects a metrics list not equal to four', () => {
    const single = metric('single', 0.9, 0.6, null);
    const complete = metric('complete', 0.8, 0.5, null);

    expect(() => rankClusteringLinkages([single, complete])).toThrow(/four/);
  });

  it('rejects duplicate linkage criteria', () => {
    const singleA = metric('single', 0.9, 0.6, null);
    const singleB = metric('single', 0.8, 0.5, null);
    const average = metric('average', 0.7, 0.4, null);
    const ward = metric('ward', 0.6, 0.3, null);

    expect(() => rankClusteringLinkages([singleA, singleB, average, ward])).toThrow(/duplicate/);
  });
});

describe('rankClusteringLinkages — boundary cases (author-owned, not in the backend suite)', () => {
  it('includes a linkage exactly at the 1e-3 tolerance in the tie set (inclusive comparison)', () => {
    // maxCophenetic - atBoundary.cophenetic must equal COPHENETIC_TIE_TOLERANCE
    // bit-for-bit, not just "look like" 1e-3 in decimal: subtracting 1e-3
    // from an arbitrary literal (e.g. `0.9 - 1e-3`) does not invert exactly
    // in IEEE-754 double arithmetic, which would make this test flaky on the
    // very precision question it exists to pin down. Subtracting from zero
    // is exact, so `leader.cophenetic (= TOLERANCE) - atBoundary (= 0)`
    // reproduces the tolerance value exactly.
    const leader = metric('single', COPHENETIC_TIE_TOLERANCE, 0.5, null);
    const atBoundary = metric('complete', 0, 0.4, null);
    const average = metric('average', -1, 0.1, null);
    const ward = metric('ward', -1, 0.1, null);

    const result = rankClusteringLinkages([leader, atBoundary, average, ward]);

    expect(result.copheneticTieSet).toEqual(['single', 'complete']);
  });

  it('excludes a linkage just past the 1e-3 tolerance from the tie set', () => {
    const leader = metric('single', COPHENETIC_TIE_TOLERANCE, 0.5, null);
    const justPast = metric('complete', -1e-9, 0.9, null);
    const average = metric('average', -1, 0.1, null);
    const ward = metric('ward', -1, 0.1, null);

    const result = rankClusteringLinkages([leader, justPast, average, ward]);

    expect(result.copheneticTieSet).toEqual(['single']);
    expect(result.bestTreeFidelity).toBe('single');
  });

  it.each([
    ['cophenetic', metric('single', Number.NaN, 0.5, null)],
    ['meanSilhouetteAtKRef', metric('single', 0.9, Number.NaN, null)],
    ['daviesBouldinAtKRef', metric('single', 0.9, 0.5, Number.NaN)],
  ])('throws instead of silently accepting a NaN %s value', (_field, tainted) => {
    const complete = metric('complete', 0.8, 0.4, 0.2);
    const average = metric('average', 0.7, 0.3, 0.2);
    const ward = metric('ward', 0.6, 0.2, 0.2);

    expect(() => rankClusteringLinkages([tainted, complete, average, ward])).toThrow(RangeError);
  });

  it('throws instead of silently accepting an Infinity cophenetic value', () => {
    const tainted = metric('single', Number.POSITIVE_INFINITY, 0.5, null);
    const complete = metric('complete', 0.8, 0.4, 0.2);
    const average = metric('average', 0.7, 0.3, 0.2);
    const ward = metric('ward', 0.6, 0.2, 0.2);

    expect(() => rankClusteringLinkages([tainted, complete, average, ward])).toThrow(RangeError);
  });
});

describe('kRefForSampleSize', () => {
  it.each([
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 4],
    [20, 4],
    [100, 4],
  ])('is min(4, n - 1): n=%i -> k_ref=%i', (sampleSize, expected) => {
    expect(kRefForSampleSize(sampleSize)).toBe(expected);
  });

  it.each([0, 1, 2, -1, 2.5])(
    'rejects a sample size that cannot yield a defined k_ref (%s)',
    (n) => {
      expect(() => kRefForSampleSize(n)).toThrow(RangeError);
    },
  );
});

describe('metricsAtKRef', () => {
  const baseResult = (
    linkageId: LinkageMetricsAtKRef['linkageId'],
    evaluation: {
      cophenetic: number;
      meanSilhouette: Record<string, number>;
      daviesBouldin: Record<string, number | null>;
    },
  ) => ({ linkageId, evaluation });

  it('reads cophenetic, meanSilhouette[k_ref] and daviesBouldin[k_ref] for each linkage', () => {
    const results = [
      baseResult('single', {
        cophenetic: 0.8,
        meanSilhouette: { '2': 0.4, '4': 0.55 },
        daviesBouldin: { '2': 0.2, '4': null },
      }),
      baseResult('ward', {
        cophenetic: 0.9,
        meanSilhouette: { '2': 0.5, '4': 0.65 },
        daviesBouldin: { '2': 0.1, '4': 0.3 },
      }),
    ];

    const metrics = metricsAtKRef(results, 4);

    expect(metrics).toEqual([
      {
        linkageId: 'single',
        cophenetic: 0.8,
        meanSilhouetteAtKRef: 0.55,
        daviesBouldinAtKRef: null,
      },
      { linkageId: 'ward', cophenetic: 0.9, meanSilhouetteAtKRef: 0.65, daviesBouldinAtKRef: 0.3 },
    ]);
  });

  it('throws when meanSilhouette has no entry at all for k_ref (missing, not null)', () => {
    const results = [
      baseResult('single', {
        cophenetic: 0.8,
        meanSilhouette: { '2': 0.4 },
        daviesBouldin: { '2': 0.2 },
      }),
    ];

    expect(() => metricsAtKRef(results, 4)).toThrow(RangeError);
  });

  it('throws when daviesBouldin has no entry at all for k_ref (missing, distinct from an explicit null)', () => {
    const results = [
      baseResult('single', {
        cophenetic: 0.8,
        meanSilhouette: { '4': 0.4 },
        daviesBouldin: { '2': 0.2 },
      }),
    ];

    expect(() => metricsAtKRef(results, 4)).toThrow(RangeError);
  });
});

describe('sampleSizeFromResponse — n comes from the response, not the corpus query', () => {
  const withLeafOrder = (length: number) => ({
    leafOrder: Array.from({ length }, (_unused, index) => index),
  });

  it('returns n when every linkage agrees on leafOrder length', () => {
    const results = [withLeafOrder(6), withLeafOrder(6), withLeafOrder(6), withLeafOrder(6)];

    expect(sampleSizeFromResponse(results)).toBe(6);
  });

  it('returns undefined when linkages disagree on leafOrder length', () => {
    const results = [withLeafOrder(6), withLeafOrder(5), withLeafOrder(6), withLeafOrder(6)];

    expect(sampleSizeFromResponse(results)).toBeUndefined();
  });

  it('returns undefined for an empty response', () => {
    expect(sampleSizeFromResponse([])).toBeUndefined();
  });
});

describe('hasCanonicalLinkageIds — ranking requires exactly {single, complete, average, ward}', () => {
  it('accepts the canonical set regardless of order', () => {
    const ids: LinkageId[] = ['ward', 'single', 'average', 'complete'];

    expect(hasCanonicalLinkageIds(ids)).toBe(true);
  });

  it('rejects a duplicate id standing in for a missing one', () => {
    const ids: LinkageId[] = ['single', 'single', 'average', 'ward'];

    expect(hasCanonicalLinkageIds(ids)).toBe(false);
  });

  it('rejects fewer than four ids', () => {
    const ids: LinkageId[] = ['single', 'complete', 'average'];

    expect(hasCanonicalLinkageIds(ids)).toBe(false);
  });

  it('rejects more than four ids', () => {
    const ids = ['single', 'complete', 'average', 'ward', 'single'] as LinkageId[];

    expect(hasCanonicalLinkageIds(ids)).toBe(false);
  });
});
