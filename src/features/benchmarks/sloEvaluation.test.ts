import { describe, expect, it } from 'vitest';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { algorithmIdFromSloFamily, evaluateSlo } from './sloEvaluation';

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

describe('evaluateSlo', () => {
  it('marks a result within the NFR-QA-01 threshold (< 5000 ms)', () => {
    const evaluation = evaluateSlo(result({ score: 11.6, unit: 'ms/op' }), 5_000);
    expect(evaluation).toEqual({
      family: 'slo-classic-levenshtein',
      valueMs: 11.6,
      thresholdMs: 5_000,
      withinThreshold: true,
    });
  });

  it('marks a result exceeding the NFR-QA-02 threshold (< 1000 ms)', () => {
    const evaluation = evaluateSlo(
      result({ family: 'slo-clustering', score: 1_500, unit: 'ms/op' }),
      1_000,
    );
    expect(evaluation.withinThreshold).toBe(false);
  });

  it('converts a non-ms unit before comparing to the threshold', () => {
    const evaluation = evaluateSlo(result({ score: 900_000, unit: 'us/op' }), 5_000);
    expect(evaluation.valueMs).toBeCloseTo(900, 6);
    expect(evaluation.withinThreshold).toBe(true);
  });
});

describe('algorithmIdFromSloFamily', () => {
  it('strips the slo-classic- prefix to show the plain algorithm id', () => {
    expect(algorithmIdFromSloFamily('slo-classic-levenshtein')).toBe('levenshtein');
    expect(algorithmIdFromSloFamily('slo-classic-needleman-wunsch')).toBe('needleman-wunsch');
  });

  it('returns the family unchanged when it has no slo-classic- prefix', () => {
    expect(algorithmIdFromSloFamily('slo-clustering')).toBe('slo-clustering');
  });
});
