/** The domain leaves this share of the merge range below the smallest merge... */
const LOWER_PADDING = 0.12;
/** ...and this share above the largest, so the merges do not crowd one edge. */
const UPPER_PADDING = 0.04;

/** Candidate tick steps, as multiples of a power of ten. */
const STEP_MANTISSAS = [1, 2, 2.5, 5, 10] as const;

/**
 * The distance axis domain fitted to the merge range: from 12% of the range
 * below the smallest merge distance (never below 0) to 4% above the largest.
 * A range of zero (every merge at one distance) still gets a non-empty domain.
 */
export function fitDistanceDomain(mergeDistances: readonly number[]): [number, number] {
  const smallest = Math.min(...mergeDistances);
  const largest = Math.max(...mergeDistances);
  const range = largest - smallest || Math.abs(largest) || 1;
  return [Math.max(0, smallest - range * LOWER_PADDING), largest + range * UPPER_PADDING];
}

/** How many decimals a tick step needs to print without rounding (`2.5` needs 1). */
export function tickDecimals(step: number): number {
  for (let decimals = 0; decimals <= 8; decimals += 1) {
    const scaled = step * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) {
      return decimals;
    }
  }
  return 8;
}

/**
 * "Nice" ticks across `[start, end]`: steps of 1, 2, 2.5 or 5 times a power of
 * ten, the step closest to what `count` ticks would need. Ticks are the
 * multiples of the step inside the domain.
 */
export function niceTicks(start: number, end: number, count: number): number[] {
  const span = end - start;
  if (!(span > 0)) {
    return [start];
  }
  const raw = span / Math.max(count, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = STEP_MANTISSAS.map((mantissa) => mantissa * magnitude).reduce((best, candidate) =>
    Math.abs(Math.log(candidate / raw)) < Math.abs(Math.log(best / raw)) ? candidate : best,
  );

  const ticks: number[] = [];
  const first = Math.ceil(start / step - 1e-9);
  for (let index = first; index * step <= end + step * 1e-9; index += 1) {
    ticks.push(Number((index * step).toFixed(10)));
  }
  return ticks;
}
