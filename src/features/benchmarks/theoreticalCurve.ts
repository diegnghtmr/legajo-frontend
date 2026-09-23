export interface CurvePoint {
  size: number;
  valueNs: number;
}

/**
 * The theoretical curve `c * size^exponent`, anchored so it passes exactly
 * through the series' own smallest strictly positive size (the task's own
 * rule: "the theoretical curve overlaid for each series as c·size^exponent
 * anchored at the series' first point" — "first" means smallest size, not
 * array position: callers are not guaranteed to hand points pre-sorted).
 * `exponent` is each family's own `theoreticalExponent` (TAC-18's
 * `BenchmarkSlope`), never derived here.
 *
 * A size of zero or less is never a valid anchor (it would divide by zero
 * or, for a negative size with a non-integer exponent, produce `NaN`) and
 * is not a meaningful benchmark input size either, so such points are
 * dropped entirely rather than plotted with an `Infinity`/`NaN` value.
 */
export function theoreticalCurvePoints(
  points: readonly CurvePoint[],
  exponent: number,
): CurvePoint[] {
  const positivePoints = points.filter((point) => point.size > 0);
  if (positivePoints.length === 0) {
    return [];
  }

  const anchor = [...positivePoints].sort((a, b) => a.size - b.size)[0]!;
  const c = anchor.valueNs / anchor.size ** exponent;

  return positivePoints.map((point) => ({
    size: point.size,
    valueNs: c * point.size ** exponent,
  }));
}
