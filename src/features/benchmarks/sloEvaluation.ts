import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { toNanoseconds } from './units';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

export interface SloEvaluation {
  family: string;
  /** The result's own `size` (fixed at 20 for every `slo-*` family), kept for a unique row key. */
  size: number;
  valueMs: number;
  thresholdMs: number;
  /** Strictly under the threshold ("< 5 s" / "< 1 s" wording). */
  withinThreshold: boolean;
}

/**
 * Reads one `slo-*` result against its fixed threshold (the classic
 * threshold is < 5000 ms per classic algorithm; the clustering threshold is
 * < 1000 ms for the four linkages). The comparison never recomputes the
 * measurement — it only
 * converts the reported score to milliseconds (`toNanoseconds`) and compares.
 */
export function evaluateSlo(result: BenchmarkResult, thresholdMs: number): SloEvaluation {
  const valueMs = toNanoseconds(result.score, result.unit) / 1_000_000;

  return {
    family: result.family,
    size: result.size,
    valueMs,
    thresholdMs,
    withinThreshold: valueMs < thresholdMs,
  };
}

const SLO_CLASSIC_PREFIX = 'slo-classic-';

/**
 * Plain algorithm id for display (e.g. `levenshtein`), stripped from a
 * `slo-classic-*` family id. A family without that prefix (`slo-clustering`,
 * which is already the display id for its one row) is returned unchanged.
 */
export function algorithmIdFromSloFamily(family: string): string {
  return family.startsWith(SLO_CLASSIC_PREFIX) ? family.slice(SLO_CLASSIC_PREFIX.length) : family;
}
