import { describe, expect, it } from 'vitest';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import {
  EMBEDDING_FAMILIES,
  embeddingResultsByDimension,
  HAC_LINKAGE_FAMILIES,
  mergeSeriesIntoRows,
  PAIRWISE_CLASSIC_FAMILIES,
  seriesForFamilies,
  SLO_CLASSIC_FAMILIES,
  SLO_CLUSTERING_FAMILY,
} from './grouping';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

function result(overrides: Partial<BenchmarkResult>): BenchmarkResult {
  return {
    benchmark: 'x',
    family: 'levenshtein',
    parameter: 'length',
    size: 50,
    score: 1,
    error: 0,
    unit: 'us/op',
    ...overrides,
  };
}

const RESULTS: BenchmarkResult[] = [
  result({ family: 'levenshtein', size: 100, score: 29.6, unit: 'us/op' }),
  result({ family: 'levenshtein', size: 50, score: 7.9, unit: 'us/op' }),
  result({ family: 'jaccard', size: 50, score: 4.5, unit: 'us/op' }),
  result({ family: 'hac-single', parameter: 'n', size: 5, score: 0.31, unit: 'us/op' }),
  result({
    family: 'embedding-dot-product',
    parameter: 'dimension',
    size: 384,
    score: 195,
    unit: 'ns/op',
  }),
  result({
    family: 'slo-classic-levenshtein',
    parameter: 'n',
    size: 20,
    score: 11.6,
    unit: 'ms/op',
  }),
  result({ family: 'slo-clustering', parameter: 'n', size: 20, score: 0.017, unit: 'ms/op' }),
];

describe('seriesForFamilies', () => {
  it('groups results by family, sorted ascending by size, converted to nanoseconds', () => {
    const series = seriesForFamilies(RESULTS, PAIRWISE_CLASSIC_FAMILIES);

    const levenshtein = series.find((entry) => entry.family === 'levenshtein');
    expect(levenshtein?.points).toEqual([
      { size: 50, valueNs: 7_900, errorNs: 0 },
      { size: 100, valueNs: 29_600, errorNs: 0 },
    ]);
  });

  it('carries each point’s JMH error, converted to nanoseconds like the score', () => {
    const series = seriesForFamilies(
      [
        result({ family: 'levenshtein', size: 50, score: 7.9, error: 0.25, unit: 'us/op' }),
        result({ family: 'levenshtein', size: 100, score: 2, error: 0.5, unit: 'ms/op' }),
      ],
      PAIRWISE_CLASSIC_FAMILIES,
    );

    expect(series[0]?.points).toEqual([
      { size: 50, valueNs: 7_900, errorNs: 250 },
      { size: 100, valueNs: 2_000_000, errorNs: 500_000 },
    ]);
  });

  it('omits a requested family with no matching results', () => {
    const series = seriesForFamilies(RESULTS, PAIRWISE_CLASSIC_FAMILIES);
    expect(series.some((entry) => entry.family === 'needleman-wunsch')).toBe(false);
    expect(series.some((entry) => entry.family === 'tfidf-cosine')).toBe(false);
  });

  it('reads the HAC linkage families', () => {
    const series = seriesForFamilies(RESULTS, HAC_LINKAGE_FAMILIES);
    expect(series).toEqual([
      { family: 'hac-single', points: [{ size: 5, valueNs: 310, errorNs: 0 }] },
    ]);
  });

  it('reads the embedding families', () => {
    const series = seriesForFamilies(RESULTS, EMBEDDING_FAMILIES);
    expect(series).toEqual([
      { family: 'embedding-dot-product', points: [{ size: 384, valueNs: 195, errorNs: 0 }] },
    ]);
  });

  it('omits a result with an unrecognized unit instead of aborting the whole family', () => {
    const withMalformedUnit: BenchmarkResult[] = [
      ...RESULTS,
      result({ family: 'levenshtein', size: 200, score: 50, unit: 'op/s' }),
    ];

    let series: ReturnType<typeof seriesForFamilies> = [];
    expect(() => {
      series = seriesForFamilies(withMalformedUnit, PAIRWISE_CLASSIC_FAMILIES);
    }).not.toThrow();

    const levenshtein = series.find((entry) => entry.family === 'levenshtein');
    expect(levenshtein?.points).toEqual([
      { size: 50, valueNs: 7_900, errorNs: 0 },
      { size: 100, valueNs: 29_600, errorNs: 0 },
    ]);
  });
});

describe('mergeSeriesIntoRows', () => {
  it('merges same-size series into one row per size, keyed by family', () => {
    const series = seriesForFamilies(RESULTS, PAIRWISE_CLASSIC_FAMILIES);
    const rows = mergeSeriesIntoRows(series);

    expect(rows).toEqual([
      { size: 50, levenshtein: 7_900, jaccard: 4_500 },
      { size: 100, levenshtein: 29_600 },
    ]);
  });

  it('returns an empty array for no series', () => {
    expect(mergeSeriesIntoRows([])).toEqual([]);
  });
});

describe('embeddingResultsByDimension', () => {
  const embeddingResults: BenchmarkResult[] = [
    result({
      family: 'embedding-dot-product',
      parameter: 'dimension',
      size: 384,
      score: 195,
      unit: 'ns/op',
    }),
    result({
      family: 'embedding-euclidean-sum-squared',
      parameter: 'dimension',
      size: 384,
      score: 210,
      unit: 'ns/op',
    }),
    result({
      family: 'embedding-dot-product',
      parameter: 'dimension',
      size: 1536,
      score: 842,
      unit: 'ns/op',
    }),
  ];

  it('groups both embedding families by dimension, sorted ascending', () => {
    expect(embeddingResultsByDimension(embeddingResults)).toEqual([
      {
        dimension: 384,
        entries: [
          { family: 'embedding-dot-product', valueNs: 195 },
          { family: 'embedding-euclidean-sum-squared', valueNs: 210 },
        ],
      },
      { dimension: 1536, entries: [{ family: 'embedding-dot-product', valueNs: 842 }] },
    ]);
  });

  it('returns an empty array with no embedding results', () => {
    expect(embeddingResultsByDimension([])).toEqual([]);
  });

  it('omits an embedding result with an unrecognized unit instead of aborting', () => {
    const withMalformedUnit: BenchmarkResult[] = [
      ...embeddingResults,
      result({
        family: 'embedding-dot-product',
        parameter: 'dimension',
        size: 768,
        score: 400,
        unit: 'op/s',
      }),
    ];

    expect(() => embeddingResultsByDimension(withMalformedUnit)).not.toThrow();
    expect(
      embeddingResultsByDimension(withMalformedUnit).some((tile) => tile.dimension === 768),
    ).toBe(false);
  });
});

describe('fixed family id lists', () => {
  it('SLO_CLASSIC_FAMILIES has the four classic algorithms', () => {
    expect([...SLO_CLASSIC_FAMILIES]).toEqual([
      'slo-classic-levenshtein',
      'slo-classic-needleman-wunsch',
      'slo-classic-jaccard',
      'slo-classic-tfidf-cosine',
    ]);
  });

  it('SLO_CLUSTERING_FAMILY is the single clustering SLO family', () => {
    expect(SLO_CLUSTERING_FAMILY).toBe('slo-clustering');
  });
});
