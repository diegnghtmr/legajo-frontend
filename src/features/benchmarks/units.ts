/** Nanoseconds per JMH throughput/time unit (TRD §6.6's `BenchmarkResult.unit`). */
const NANOSECONDS_PER_UNIT: Record<string, number> = {
  'ns/op': 1,
  'us/op': 1_000,
  'ms/op': 1_000_000,
  's/op': 1_000_000_000,
};

/**
 * Converts a raw JMH score to nanoseconds so every family, regardless of its
 * own reported unit, can be compared and charted on one axis. Never called
 * with an unrecognized unit in practice (JMH only emits the four above), but
 * throws rather than silently misreading the magnitude.
 */
export function toNanoseconds(score: number, unit: string): number {
  const factor = NANOSECONDS_PER_UNIT[unit];
  if (factor === undefined) {
    throw new Error(`Unknown JMH unit: ${unit}`);
  }
  return score * factor;
}

/** Trims to at most one decimal place, dropping a trailing ".0". */
function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Picks the most legible unit (ns / µs / ms / s) for a nanosecond duration,
 * for mono display next to a chart or metric tile. Purely presentational —
 * never used for the underlying comparisons, which always stay in
 * nanoseconds (`toNanoseconds`).
 */
export function formatDuration(nanoseconds: number): string {
  if (nanoseconds < 1_000) {
    return `${formatNumber(nanoseconds)} ns`;
  }
  if (nanoseconds < 1_000_000) {
    return `${formatNumber(nanoseconds / 1_000)} µs`;
  }
  if (nanoseconds < 1_000_000_000) {
    return `${formatNumber(nanoseconds / 1_000_000)} ms`;
  }
  return `${formatNumber(nanoseconds / 1_000_000_000)} s`;
}
