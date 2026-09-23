export interface CurvePoint {
  size: number;
  valueNs: number;
}

/**
 * The theoretical curve `c * size^exponent`, anchored so it passes exactly
 * through `points[0]` (the task's own rule: "the theoretical curve overlaid
 * for each series as c·size^exponent anchored at the series' first point").
 * `exponent` is each family's own `theoreticalExponent` (TAC-18's
 * `BenchmarkSlope`), never derived here.
 */
export function theoreticalCurvePoints(
  points: readonly CurvePoint[],
  exponent: number,
): CurvePoint[] {
  if (points.length === 0) {
    return [];
  }

  const anchor = points[0]!;
  const c = anchor.valueNs / anchor.size ** exponent;

  return points.map((point) => ({ size: point.size, valueNs: c * point.size ** exponent }));
}
