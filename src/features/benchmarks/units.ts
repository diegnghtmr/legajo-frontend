/**
 * Nanoseconds per JMH throughput/time unit (`BenchmarkResult.unit`).
 * A `Map`, not a plain object: a plain object's lookup would silently resolve
 * an unrecognized unit like `"constructor"` or `"toString"` to an inherited
 * `Object.prototype` value instead of `undefined`, turning a malformed unit
 * into a silent `NaN` rather than the intended rejection below.
 */
const NANOSECONDS_PER_UNIT = new Map<string, number>([
  ['ns/op', 1],
  ['us/op', 1_000],
  ['ms/op', 1_000_000],
  ['s/op', 1_000_000_000],
]);

/**
 * Converts a raw JMH score to nanoseconds so every family, regardless of its
 * own reported unit, can be compared and charted on one axis. Never called
 * with an unrecognized unit in practice (JMH only emits the four above), but
 * throws rather than silently misreading the magnitude.
 */
export function toNanoseconds(score: number, unit: string): number {
  const factor = NANOSECONDS_PER_UNIT.get(unit);
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

const DURATION_UNITS = [
  { suffix: 'ns', divisor: 1 },
  { suffix: 'µs', divisor: 1_000 },
  { suffix: 'ms', divisor: 1_000_000 },
  { suffix: 's', divisor: 1_000_000_000 },
] as const;

/**
 * Picks the most legible unit (ns / µs / ms / s) for a nanosecond duration,
 * for mono display next to a chart or metric tile. Purely presentational —
 * never used for the underlying comparisons, which always stay in
 * nanoseconds (`toNanoseconds`).
 *
 * The unit is chosen only after rounding to one decimal place: picking it
 * from the raw magnitude first (e.g. `nanoseconds < 1_000_000` for ms) lets
 * a value like `999_999_999` ns round to "1000.0 ms" instead of bumping up
 * to "1 s", and `999.96` ns round to "1000.0 ns" instead of "1 µs".
 */
export function formatDuration(nanoseconds: number): string {
  let unitIndex = 0;
  for (let index = DURATION_UNITS.length - 1; index >= 0; index -= 1) {
    if (nanoseconds >= DURATION_UNITS[index].divisor) {
      unitIndex = index;
      break;
    }
  }

  while (unitIndex < DURATION_UNITS.length - 1) {
    const rounded = Math.round((nanoseconds / DURATION_UNITS[unitIndex]!.divisor) * 10) / 10;
    if (rounded < 1_000) {
      break;
    }
    unitIndex += 1;
  }

  const { suffix, divisor } = DURATION_UNITS[unitIndex]!;
  return `${formatNumber(nanoseconds / divisor)} ${suffix}`;
}
