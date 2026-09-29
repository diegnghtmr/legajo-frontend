import { describe, expect, it } from 'vitest';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import {
  algorithmIdFromSloFamily,
  evaluateSlo,
  formatHeadroomFactor,
  headroomFactor,
  sloBarFraction,
} from './sloEvaluation';

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
  it('marks a result within the classic threshold (< 5000 ms)', () => {
    const evaluation = evaluateSlo(result({ score: 11.6, unit: 'ms/op' }), 5_000);
    expect(evaluation).toEqual({
      family: 'slo-classic-levenshtein',
      size: 20,
      valueMs: 11.6,
      thresholdMs: 5_000,
      withinThreshold: true,
    });
  });

  it('marks a result exceeding the clustering threshold (< 1000 ms)', () => {
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

describe('sloBarFraction', () => {
  it('runs from 1 µs at the left to the threshold at the right on a log scale', () => {
    // 1 µs = 0.001 ms; a threshold of 1000 ms spans six decades.
    expect(sloBarFraction(0.001, 1_000)).toBeCloseTo(0);
    expect(sloBarFraction(1_000, 1_000)).toBeCloseTo(1);
    expect(sloBarFraction(1, 1_000)).toBeCloseTo(0.5);
  });

  it('places 17 µs against a 1 s threshold by its decades, not its ratio', () => {
    expect(sloBarFraction(0.017, 1_000)).toBeCloseTo((Math.log10(17) - 0) / 6, 5);
  });

  it('pins a measurement past the threshold to the end and one under 1 µs to the start', () => {
    expect(sloBarFraction(9_000, 1_000)).toBe(1);
    expect(sloBarFraction(0.0001, 1_000)).toBe(0);
    expect(sloBarFraction(0, 1_000)).toBe(0);
  });
});

describe('headroomFactor', () => {
  it('is how many times the measurement fits under the threshold', () => {
    expect(headroomFactor(50, 5_000)).toBe(100);
  });
});

describe('formatHeadroomFactor', () => {
  it('keeps one decimal below 10', () => {
    expect(formatHeadroomFactor(4.26)).toBe('4.3');
    expect(formatHeadroomFactor(1.04)).toBe('1.0');
  });

  it('rounds to an integer from 10', () => {
    expect(formatHeadroomFactor(10)).toBe('10');
    expect(formatHeadroomFactor(431.03)).toBe('431');
    expect(formatHeadroomFactor(58_823.5)).toBe('58824');
  });

  it('never rounds a factor under 10 up into the integer range with a trailing decimal', () => {
    expect(formatHeadroomFactor(9.96)).toBe('10');
  });
});
