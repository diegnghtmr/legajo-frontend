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

/** The left end of every SLO bar: 1 µs, in milliseconds. */
const BAR_FLOOR_MS = 0.001;

/**
 * How far along its bar a measurement sits, as a fraction: a log scale from
 * 1 µs (left) to the threshold (right end). A measurement past the threshold
 * pins to the end, and one at or under 1 µs to the start.
 */
export function sloBarFraction(valueMs: number, thresholdMs: number): number {
  if (valueMs <= BAR_FLOOR_MS) {
    return 0;
  }
  const fraction =
    (Math.log10(valueMs) - Math.log10(BAR_FLOOR_MS)) /
    (Math.log10(thresholdMs) - Math.log10(BAR_FLOOR_MS));
  return Math.min(fraction, 1);
}

/** How many times the measurement fits under the threshold. */
export function headroomFactor(valueMs: number, thresholdMs: number): number {
  return thresholdMs / valueMs;
}

/** One decimal below 10, a whole number from 10 (a factor that rounds up to 10 is shown as 10). */
export function formatHeadroomFactor(factor: number): string {
  if (!Number.isFinite(factor)) {
    return '∞';
  }
  const oneDecimal = Math.round(factor * 10) / 10;
  return oneDecimal >= 10 ? String(Math.round(factor)) : oneDecimal.toFixed(1);
}
