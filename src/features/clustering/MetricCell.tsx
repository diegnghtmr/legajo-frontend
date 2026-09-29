import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { formatMetricValue } from './formatMetricValue';
import type { MetricPoint } from './metricBars';

/** The stagger index stops growing here: later rows share the last delay. */
const MAX_STAGGER_INDEX = 11;

const SPARK_WIDTH = 60;
const SPARK_HEIGHT = 18;
const SPARK_PAD_X = 3;
const SPARK_TOP = 3;
const SPARK_BOTTOM = 15;

export interface MetricSparklineProps {
  /** Every k the response carries, ascending. */
  series: readonly MetricPoint[];
  /** The k being viewed: drawn as the larger ink point. */
  activeK: number;
}

/**
 * A 60 × 18 sparkline of one metric across every k the response carries. It
 * is decoration: `aria-hidden`, with a visually hidden sentence listing every
 * k and its value, so no value depends on the drawing. A k whose metric is
 * undefined is left off the line but still listed.
 */
export function MetricSparkline({ series, activeK }: MetricSparklineProps) {
  const { t } = useTranslation();
  const undefinedLabel = t('clustering.metrics.undefinedValue');
  const points = series.filter(
    (point): point is { k: number; value: number } =>
      point.value !== null && Number.isFinite(point.value),
  );
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (index: number) =>
    points.length > 1
      ? SPARK_PAD_X + (index / (points.length - 1)) * (SPARK_WIDTH - 2 * SPARK_PAD_X)
      : SPARK_WIDTH / 2;
  const y = (value: number) =>
    high === low
      ? (SPARK_TOP + SPARK_BOTTOM) / 2
      : SPARK_BOTTOM - ((value - low) / span) * (SPARK_BOTTOM - SPARK_TOP);

  const list = series
    .map(
      (point) =>
        `k = ${point.k}: ${point.value === null ? undefinedLabel : formatMetricValue(point.value)}`,
    )
    .join(', ');

  return (
    <>
      <svg
        width={SPARK_WIDTH}
        height={SPARK_HEIGHT}
        viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d={points
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`)
            .join('')}
          fill="none"
          strokeWidth="1"
          className="stroke-ink-muted"
        />
        {points.map((point, index) => (
          <circle
            key={point.k}
            cx={x(index)}
            cy={y(point.value)}
            r={point.k === activeK ? 2.5 : 1.25}
            className={
              point.k === activeK
                ? 'fill-ink motion-safe:transition-[r] motion-safe:duration-(--dur-fast)'
                : 'fill-ink-muted motion-safe:transition-[r] motion-safe:duration-(--dur-fast)'
            }
          />
        ))}
      </svg>
      <span className="sr-only">{t('clustering.metrics.sparklineSummary', { list })}</span>
    </>
  );
}

export interface MetricCellProps {
  /** The backend's number; `null` when the metric is undefined for this cut. */
  value: number | null;
  /** How full the bar is, from `metricBars.ts`. */
  fraction: number;
  /** The row index, for the staggered bar growth. */
  index: number;
  /** The metric across every k: adds a sparkline. */
  series?: readonly MetricPoint[];
  activeK?: number;
}

/**
 * One metric cell: the mono value, an inline bar relative to the column's
 * best, and optionally a sparkline across k. The bar and sparkline are
 * presentation; the number (and the hidden sentence) is the value.
 */
export function MetricCell({ value, fraction, index, series, activeK }: MetricCellProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2.5">
      <span className="min-w-14 font-mono text-mono text-ink">
        {value === null ? t('clustering.metrics.undefinedValue') : formatMetricValue(value)}
      </span>
      <div
        data-slot="metric-bar"
        aria-hidden="true"
        className="h-1.5 w-[72px] shrink-0 overflow-hidden rounded-full bg-paper-sunken"
      >
        <div
          className="enter-grow h-full rounded-full bg-ink"
          style={
            {
              width: `${fraction * 100}%`,
              '--i': Math.min(index, MAX_STAGGER_INDEX),
            } as CSSProperties
          }
        />
      </div>
      {series && activeK !== undefined && <MetricSparkline series={series} activeK={activeK} />}
    </div>
  );
}
