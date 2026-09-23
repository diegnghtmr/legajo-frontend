import { z } from 'zod';

/**
 * Reference-harness metadata (TRD §6.6, 1.3.10): every field is always
 * present, since the export fails closed on a missing harness key.
 */
export const BenchmarkHarnessSchema = z.object({
  cpuModel: z.string(),
  logicalCores: z.number(),
  totalRamBytes: z.number(),
  jdk: z.string(),
  os: z.string(),
  measuredAt: z.string(),
});

/**
 * One benchmark method at one parameter value, read as-is from
 * `jmh-results.csv` (TRD §6.6). Includes the `slo-*` families and both
 * embedding-dimension measurements.
 */
export const BenchmarkResultSchema = z.object({
  benchmark: z.string(),
  family: z.string(),
  parameter: z.string(),
  size: z.number(),
  score: z.number(),
  error: z.number(),
  unit: z.string(),
});

/** Least-squares log-log slope of one curve family (TAC-18); no `slo-*` entries. */
export const BenchmarkSlopeSchema = z.object({
  family: z.string(),
  points: z.number(),
  empiricalSlope: z.number(),
  theoreticalExponent: z.number(),
});

export const BenchmarkReportSchema = z.object({
  harness: BenchmarkHarnessSchema,
  results: z.array(BenchmarkResultSchema),
  slopes: z.array(BenchmarkSlopeSchema),
});
