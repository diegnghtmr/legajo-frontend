import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import type { components } from '../../shared/types/api';
import {
  BenchmarkHarnessSchema,
  BenchmarkReportSchema,
  BenchmarkResultSchema,
  BenchmarkSlopeSchema,
} from './benchmarks';

type BenchmarkHarness = components['schemas']['BenchmarkHarness'];
type BenchmarkResult = components['schemas']['BenchmarkResult'];
type BenchmarkSlope = components['schemas']['BenchmarkSlope'];
type BenchmarkReport = components['schemas']['BenchmarkReport'];

describe('benchmarks schemas (contract)', () => {
  it('BenchmarkHarnessSchema matches BenchmarkHarness', () => {
    expectTypeOf<z.infer<typeof BenchmarkHarnessSchema>>().toEqualTypeOf<BenchmarkHarness>();
  });

  it('BenchmarkResultSchema matches BenchmarkResult', () => {
    expectTypeOf<z.infer<typeof BenchmarkResultSchema>>().toEqualTypeOf<BenchmarkResult>();
  });

  it('BenchmarkSlopeSchema matches BenchmarkSlope', () => {
    expectTypeOf<z.infer<typeof BenchmarkSlopeSchema>>().toEqualTypeOf<BenchmarkSlope>();
  });

  it('BenchmarkReportSchema matches BenchmarkReport', () => {
    expectTypeOf<z.infer<typeof BenchmarkReportSchema>>().toEqualTypeOf<BenchmarkReport>();
  });
});

describe('BenchmarkHarnessSchema (runtime)', () => {
  const validPayload = {
    cpuModel: '12th Gen Intel(R) Core(TM) i9-12900H',
    logicalCores: 20,
    totalRamBytes: 33363460096,
    jdk: 'Eclipse Adoptium 25.0.4',
    os: 'Linux 7.2.5-3-omarchy (amd64)',
    measuredAt: '2026-09-23T00:43:04.800549029Z',
  };

  it('accepts a real-shaped harness', () => {
    expect(BenchmarkHarnessSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects a payload missing measuredAt', () => {
    const { measuredAt: _measuredAt, ...withoutMeasuredAt } = validPayload;
    expect(BenchmarkHarnessSchema.safeParse(withoutMeasuredAt).success).toBe(false);
  });
});

describe('BenchmarkResultSchema (runtime)', () => {
  const validPayload = {
    benchmark: 'co.edu.uniquindio.legajo.benchmarks.pairwise.LevenshteinBenchmark.pairwiseCompute',
    family: 'levenshtein',
    parameter: 'length',
    size: 50,
    score: 7.893776651306136,
    error: 1.0946599763714326,
    unit: 'us/op',
  };

  it('accepts a real-shaped result', () => {
    expect(BenchmarkResultSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects a payload missing unit', () => {
    const { unit: _unit, ...withoutUnit } = validPayload;
    expect(BenchmarkResultSchema.safeParse(withoutUnit).success).toBe(false);
  });

  it('rejects a non-numeric size', () => {
    expect(BenchmarkResultSchema.safeParse({ ...validPayload, size: '50' }).success).toBe(false);
  });
});

describe('BenchmarkSlopeSchema (runtime)', () => {
  const validPayload = {
    family: 'levenshtein',
    points: 5,
    empiricalSlope: 2.039288,
    theoreticalExponent: 2,
  };

  it('accepts a real-shaped slope', () => {
    expect(BenchmarkSlopeSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects a payload missing theoreticalExponent', () => {
    const { theoreticalExponent: _theoreticalExponent, ...withoutExponent } = validPayload;
    expect(BenchmarkSlopeSchema.safeParse(withoutExponent).success).toBe(false);
  });
});

describe('BenchmarkReportSchema (runtime)', () => {
  it('accepts a real-shaped report with empty results/slopes arrays', () => {
    expect(
      BenchmarkReportSchema.safeParse({
        harness: {
          cpuModel: 'x',
          logicalCores: 1,
          totalRamBytes: 1,
          jdk: 'x',
          os: 'x',
          measuredAt: '2026-01-01T00:00:00Z',
        },
        results: [],
        slopes: [],
      }).success,
    ).toBe(true);
  });

  it('rejects a payload missing harness', () => {
    expect(BenchmarkReportSchema.safeParse({ results: [], slopes: [] }).success).toBe(false);
  });
});
