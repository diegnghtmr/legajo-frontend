export type MetricDirection = 'higher' | 'lower';

/** The shortest a bar is ever drawn: an undefined or non-positive value still
 * shows a stub, so the row reads as "measured, and worst" rather than empty. */
const MIN_BAR_FRACTION = 0.04;

function isUsable(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

/**
 * The best value of a metric column — the largest for a higher-is-better
 * metric, the smallest positive one for a lower-is-better metric — that the
 * bars are drawn relative to. `undefined` when no value is usable.
 */
export function columnBest(
  values: readonly (number | null | undefined)[],
  direction: MetricDirection,
): number | undefined {
  const usable = values.filter(isUsable);
  if (direction === 'higher') {
    return usable.length > 0 ? Math.max(...usable) : undefined;
  }
  const positive = usable.filter((value) => value > 0);
  return positive.length > 0 ? Math.min(...positive) : undefined;
}

/**
 * How full a metric's inline bar is, relative to its column's best:
 * `value / best` for a higher-is-better metric, `best / value` for a
 * lower-is-better one, clamped to `[4%, 100%]`. Presentation only — the
 * number beside the bar is the value. An undefined, non-positive or
 * non-finite value, or a column with no positive best, shows the stub.
 */
export function barFraction(
  value: number | null | undefined,
  best: number | undefined,
  direction: MetricDirection,
): number {
  if (!isUsable(value) || value <= 0 || best === undefined || best <= 0) {
    return MIN_BAR_FRACTION;
  }
  const fraction = direction === 'higher' ? value / best : best / value;
  return Math.min(1, Math.max(MIN_BAR_FRACTION, fraction));
}

export interface MetricPoint {
  k: number;
  /** `null` when the backend reports the metric undefined for that cut. */
  value: number | null;
}

/** A per-k metric record (`meanSilhouette`, `daviesBouldin`) as points in ascending k. */
export function metricSeries(record: Readonly<Record<string, number | null>>): MetricPoint[] {
  return Object.entries(record)
    .map(([key, value]) => ({ k: Number(key), value }))
    .sort((a, b) => a.k - b.k);
}
