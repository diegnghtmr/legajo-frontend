/**
 * Powers-of-ten tick values spanning every positive value in `values`, for
 * a log-scale axis. Recharts' own automatic log-scale ticks land on
 * arbitrary sub-multiples of the data's domain instead (e.g. 40, 300, 800),
 * never true decades — this computes the fixed decade sequence
 * `[10^floor(log10(min)), … , 10^ceil(log10(max))]` instead, so a log–log
 * chart's y-axis always reads in powers of ten.
 *
 * Returns an empty array when there is no positive value to span (an axis
 * with no plottable data at all); a log scale has no representation for a
 * zero or negative value in the first place, so those are simply ignored
 * here rather than breaking the whole computation.
 */
export function logDecadeTicks(values: readonly number[]): number[] {
  const positiveValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (positiveValues.length === 0) {
    return [];
  }

  const min = Math.min(...positiveValues);
  const max = Math.max(...positiveValues);
  // A tiny epsilon guards against floating-point log10 imprecision (e.g.
  // `Math.log10(1000)` can land a hair under `3`), which would otherwise
  // widen the decade range by one extra step for an exact power of ten.
  const epsilon = 1e-9;
  const minExponent = Math.floor(Math.log10(min) + epsilon);
  const maxExponent = Math.ceil(Math.log10(max) - epsilon);

  const ticks: number[] = [];
  for (let exponent = minExponent; exponent <= maxExponent; exponent += 1) {
    ticks.push(10 ** exponent);
  }
  return ticks;
}
