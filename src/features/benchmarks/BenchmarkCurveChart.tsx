import { CartesianGrid, Line, LineChart, XAxis, YAxis, type DotItemDotProps } from 'recharts';
import { useTranslation } from 'react-i18next';

import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { useElementWidth } from '../../shared/hooks/useElementWidth';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shared/components/ui/table';
import { mergeSeriesIntoRows, type FamilySeries } from './grouping';
import { logDecadeTicks } from './logDecadeTicks';
import { dashPatternForIndex, markerShapeForIndex, type MarkerShape } from './seriesStyle';
import { theoreticalCurvePoints } from './theoreticalCurve';
import { formatDuration } from './units';

export interface FamilySlope {
  empiricalSlope: number;
  theoreticalExponent: number;
}

export interface BenchmarkCurveChartProps {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  series: readonly FamilySeries[];
  slopes: ReadonlyMap<string, FamilySlope>;
  scale: 'linear' | 'log-log';
  dataTableCaption: string;
  slopeTableCaption: string;
}

/** Same shape as `DendrogramCard`'s own `INITIAL_WIDTH`: what a chart
 * renders at before its `ResizeObserver` ever reports a real measurement
 * (also jsdom's own permanent width in a test with no fake observer
 * installed — see `useElementWidth`'s own doc comment). */
const INITIAL_WIDTH = 640;
/** Exported so this chart's own loading skeleton reserves exactly this
 * height, causing no shift once the real chart replaces it. */
export const CHART_HEIGHT = 280;
const DOT_RADIUS = 4;

function theoreticalKey(family: string): string {
  return `${family}__theoretical`;
}

function formatSlopeNumber(value: number): string {
  return value.toFixed(2);
}

/**
 * A log axis has no representation for zero or a negative value (`Math.log`
 * of either is `-Infinity`/`NaN`), which breaks Recharts' domain calculation
 * for the *entire* chart, not just the offending point — every series goes
 * blank, not only the bad one. On `log-log`, such points are excluded from
 * the plotted series; they stay in the sr-only data table below, which
 * always reflects every raw measured value regardless of scale.
 */
function plottableOnScale(
  point: { size: number; valueNs: number },
  scale: 'linear' | 'log-log',
): boolean {
  return scale !== 'log-log' || (point.size > 0 && point.valueNs > 0);
}

function seriesForPlotting(
  series: readonly FamilySeries[],
  scale: 'linear' | 'log-log',
): FamilySeries[] {
  if (scale !== 'log-log') {
    return series as FamilySeries[];
  }
  return series.map((entry) => ({
    family: entry.family,
    points: entry.points.filter((point) => plottableOnScale(point, scale)),
  }));
}

/** Renders one grayscale marker shape per series (color is never the only channel). */
function seriesDot(shape: MarkerShape) {
  return function SeriesDot(props: DotItemDotProps) {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) {
      return null;
    }

    const fill = 'var(--color-ink)';
    switch (shape) {
      case 'circle':
        return <circle data-shape="circle" cx={cx} cy={cy} r={DOT_RADIUS} fill={fill} />;
      case 'square':
        return (
          <rect
            data-shape="square"
            x={cx - DOT_RADIUS}
            y={cy - DOT_RADIUS}
            width={DOT_RADIUS * 2}
            height={DOT_RADIUS * 2}
            fill={fill}
          />
        );
      case 'diamond':
        return (
          <rect
            data-shape="diamond"
            x={cx - DOT_RADIUS}
            y={cy - DOT_RADIUS}
            width={DOT_RADIUS * 2}
            height={DOT_RADIUS * 2}
            fill={fill}
            transform={`rotate(45 ${cx} ${cy})`}
          />
        );
      case 'triangle':
        return (
          <polygon
            data-shape="triangle"
            points={`${cx},${cy - DOT_RADIUS} ${cx - DOT_RADIUS},${cy + DOT_RADIUS} ${cx + DOT_RADIUS},${cy + DOT_RADIUS}`}
            fill={fill}
          />
        );
      default:
        return null;
    }
  };
}

/**
 * One curve group: grayscale series distinguished by
 * dash pattern and marker shape, the theoretical curve overlaid per series
 * (dotted), a linear/log–log scale, a visible empirical-vs-theoretical slope
 * table, and an sr-only data table so every measured value is available
 * without reading the chart (same reasoning as `Dendrogram`'s merge table).
 */
export function BenchmarkCurveChart({
  title,
  xAxisLabel,
  yAxisLabel,
  series,
  slopes,
  scale,
  dataTableCaption,
  slopeTableCaption,
}: BenchmarkCurveChartProps) {
  const { t } = useTranslation();
  const [containerRef, width] = useElementWidth<HTMLDivElement>(INITIAL_WIDTH);

  if (series.length === 0) {
    return (
      <Panel>
        <PanelHeader title={title} />
        <p role="status" className="text-body text-ink-secondary">
          {t('benchmarks.curves.noData')}
        </p>
      </Panel>
    );
  }

  const chartData = mergeSeriesIntoRows(series);
  const plottedSeries = seriesForPlotting(series, scale);
  const rowsBySize = new Map(
    mergeSeriesIntoRows(plottedSeries).map((row) => [row.size, { ...row }]),
  );

  for (const { family, points } of plottedSeries) {
    const slope = slopes.get(family);
    if (!slope) {
      continue;
    }
    for (const point of theoreticalCurvePoints(points, slope.theoreticalExponent)) {
      const row = rowsBySize.get(point.size) ?? { size: point.size };
      row[theoreticalKey(family)] = point.valueNs;
      rowsBySize.set(point.size, row);
    }
  }

  const mergedData = [...rowsBySize.values()].sort((a, b) => a.size - b.size);
  const axisScale = scale === 'log-log' ? 'log' : 'linear';
  const familiesWithSlopes = series.filter((entry) => slopes.has(entry.family));

  // Recharts' own automatic log-scale ticks land on arbitrary sub-multiples
  // of the domain (e.g. 40 µs, 300 µs, 800 µs), never true decades — explicit
  // `ticks` (and a matching `domain`) fix the y-axis to powers of ten
  // instead, computed from every value actually plotted on this scale
  // (including the theoretical curves, which can extend past the empirical
  // points' own range).
  const yAxisTicks =
    axisScale === 'log'
      ? logDecadeTicks(
          mergedData.flatMap((row) =>
            Object.entries(row)
              .filter(([key]) => key !== 'size')
              .map(([, value]) => value),
          ),
        )
      : [];
  // Padded half a decade below/above the outermost ticks, in log space
  // (never the bare tick bounds themselves): a domain that starts exactly
  // at the lowest tick's own value plants that tick's label right where
  // the x-axis's own first tick label already sits, in the plot's
  // bottom-left corner — this keeps every tick's own row/column clear of
  // that corner without adding a tick nothing plotted actually reaches.
  const HALF_DECADE = Math.sqrt(10);
  const yAxisDomain: [number | 'auto', number | 'auto'] =
    yAxisTicks.length > 0
      ? [yAxisTicks[0]! / HALF_DECADE, yAxisTicks[yAxisTicks.length - 1]! * HALF_DECADE]
      : ['auto', 'auto'];

  return (
    <Panel>
      <PanelHeader title={title} />

      {/*
       * The axis titles render as plain HTML text OUTSIDE the chart's own
       * SVG, in their own flex cells — never Recharts' `label` prop (its
       * `insideLeft`/`insideBottom` positions draw the title inside the
       * same column the tick numbers occupy, which overlaps them at every
       * width and on both scales; there is no tick-column width this
       * project's own tick values stay short enough to always clear). A
       * fixed-width column for the vertical y-axis title and a plain
       * paragraph under the x-axis reserve their own space instead, so the
       * two can never share a pixel with a tick label — both are plain,
       * visible text, so they show for every viewer the same way the
       * sr-only data table's already-complete raw values do for assistive
       * tech. `role="group"` stays on the chart's own measured container
       * (never the outer row, which would also include the y-axis title's
       * own column) so its bounding box keeps matching the SVG's measured
       * width one-to-one, the same invariant the "fills its own measured
       * container width" test already relies on. The outer row itself
       * carries `data-testid="benchmark-chart-row"` (not unique — filtered
       * by its own `role="group"` descendant's accessible name) purely so
       * the e2e text-overlap guard can scan the y-axis title alongside the
       * chart it is checked against, without disturbing that bounding-box
       * invariant on the inner `role="group"` element itself.
       */}
      <div data-testid="benchmark-chart-row" className="flex items-stretch gap-2">
        <span
          className="flex w-5 shrink-0 items-center justify-center whitespace-nowrap text-mono text-ink-secondary"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {yAxisLabel}
        </span>
        <div
          ref={containerRef}
          role="group"
          aria-label={title}
          data-scale={axisScale}
          className="min-w-0 flex-1"
        >
          <LineChart
            width={width}
            height={CHART_HEIGHT}
            data={mergedData}
            accessibilityLayer={false}
            margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
          >
            <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" />
            <XAxis
              dataKey="size"
              type="number"
              scale={axisScale}
              domain={['auto', 'auto']}
              className="text-mono"
            />
            <YAxis
              type="number"
              scale={axisScale}
              domain={yAxisDomain}
              ticks={yAxisTicks.length > 0 ? yAxisTicks : undefined}
              tickFormatter={(value: number) => formatDuration(value)}
              className="text-mono"
              width={72}
            />
            {series.map((entry, index) => (
              <Line
                key={entry.family}
                dataKey={entry.family}
                name={entry.family}
                stroke="var(--color-ink)"
                strokeWidth={1.5}
                strokeDasharray={dashPatternForIndex(index) || undefined}
                dot={seriesDot(markerShapeForIndex(index))}
                isAnimationActive={false}
                connectNulls
              />
            ))}
            {familiesWithSlopes.map((entry) => (
              <Line
                key={theoreticalKey(entry.family)}
                dataKey={theoreticalKey(entry.family)}
                name={t('benchmarks.curves.legendTheoretical', { family: entry.family })}
                stroke="var(--color-ink-muted)"
                strokeWidth={1}
                strokeDasharray="2 2"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
          <p className="mt-1 text-center text-mono text-ink-secondary">{xAxisLabel}</p>
        </div>
      </div>

      {/*
       * The four series differ only by dash pattern (grayscale-first,
       * `seriesStyle.ts`): without a key, that distinction is invisible.
       * Each entry pairs a swatch matching the chart line's own dash with
       * the algorithm id in mono — the visible text is what assistive tech
       * reads, so the decorative swatch itself is `aria-hidden`.
       */}
      <ul
        aria-label={t('benchmarks.curves.legend')}
        className="mt-3 flex flex-wrap gap-x-4 gap-y-2"
      >
        {series.map((entry, index) => {
          const dash = dashPatternForIndex(index) || undefined;
          return (
            <li key={entry.family} className="flex items-center gap-2">
              <svg
                data-testid={`legend-swatch-${entry.family}`}
                aria-hidden="true"
                width="20"
                height="10"
                className="shrink-0"
              >
                <line
                  data-testid={`legend-dash-${entry.family}`}
                  x1="0"
                  y1="5"
                  x2="20"
                  y2="5"
                  stroke="var(--color-ink)"
                  strokeWidth="1.5"
                  strokeDasharray={dash}
                />
              </svg>
              <span className="font-mono text-mono text-ink">{entry.family}</span>
            </li>
          );
        })}
      </ul>

      {familiesWithSlopes.length > 0 && (
        // The single scroll container for this table (its own keyboard
        // focusability and accessible name — WCAG 2.1.1's
        // `scrollable-region-focusable`, reported live at 390px against the
        // reference benchmarks screen): none of its cells are themselves
        // focusable, unlike `CompareTable`'s own row-as-button results
        // table, so — like `MatrixTable`/`TfIdfTracePanel`'s own term
        // table — this region needs to be the one reachable, focusable
        // ancestor itself. `Table`'s own default wrapper is skipped
        // (`wrap={false}`) so this stays the only `overflow` ancestor.
        <div
          role="region"
          aria-label={slopeTableCaption}
          tabIndex={0}
          className="mt-3 overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Table wrap={false}>
            <TableCaption className="sr-only">{slopeTableCaption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('benchmarks.curves.slopeTableFamily')}</TableHead>
                <TableHead>{t('benchmarks.curves.slopeTableEmpirical')}</TableHead>
                <TableHead>{t('benchmarks.curves.slopeTableTheoretical')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {familiesWithSlopes.map((entry) => {
                const slope = slopes.get(entry.family)!;
                return (
                  <TableRow key={entry.family}>
                    <TableCell className="font-mono text-mono text-ink">{entry.family}</TableCell>
                    <TableCell className="font-mono text-mono text-ink">
                      {formatSlopeNumber(slope.empiricalSlope)}
                    </TableCell>
                    <TableCell className="font-mono text-mono text-ink">
                      {formatSlopeNumber(slope.theoreticalExponent)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/*
       * `Table`'s own base classes always include `w-full`, which
       * `tailwind-merge` never treats as conflicting with `sr-only` (they
       * sit in different utility groups), so plain `className="sr-only"`
       * would leave `w-full` in the merged class list. `sr-only` correctly
       * makes this table `position: absolute`, but with no `position:
       * relative` ancestor its `width: 100%` then resolves against the
       * viewport, not against this card -- silently widening the whole
       * page. `w-px` shares `tailwind-merge`'s own "width" group with
       * `w-full`, so adding it after `sr-only` drops `w-full` from the
       * merge.
       *
       * `w-px` alone is still not enough (verified against a live render,
       * same lesson `Dendrogram.tsx`'s own merge table already documents):
       * with the default auto table layout, an explicit `width` is only a
       * suggestion the browser overrides once a cell's *unbreakable*
       * content is wider, and `sr-only` itself sets `white-space: nowrap`,
       * making every cell's full text one such unbreakable run.
       * `table-fixed` stops the table from growing past `width` to fit its
       * content, and `whitespace-normal` lets that content wrap instead of
       * forcing it, so together with `w-px` this table actually collapses
       * to its narrowest single word instead of silently reverting to its
       * full unwrapped content width.
       */}
      <Table aria-label={dataTableCaption} className="sr-only w-px table-fixed whitespace-normal">
        <TableCaption>{dataTableCaption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('benchmarks.curves.dataTableSize')}</TableHead>
            {series.map((entry) => (
              <TableHead key={entry.family}>{entry.family}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {chartData.map((row) => (
            <TableRow key={row.size}>
              <TableCell>{row.size}</TableCell>
              {series.map((entry) => (
                <TableCell key={entry.family}>
                  {row[entry.family] === undefined
                    ? t('benchmarks.curves.dataTableMissingValue')
                    : formatDuration(row[entry.family]!)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

export interface BenchmarkCurveChartSkeletonProps {
  title: string;
  /** The group's own fixed family count (e.g. the four pairwise classic
   * algorithms) — already known before the request resolves, unlike the
   * per-size data points themselves. */
  seriesCount: number;
}

/**
 * Mirrors one `BenchmarkCurveChart` card: its real title (already known —
 * every group's title is fixed chrome, not response data), a chart-height
 * placeholder at exactly `CHART_HEIGHT` so the swap causes no shift, and a
 * legend row with one swatch per series the group is known to have.
 */
export function BenchmarkCurveChartSkeleton({
  title,
  seriesCount,
}: BenchmarkCurveChartSkeletonProps) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <Skeleton
        data-testid="benchmark-chart-skeleton"
        className="w-full rounded-md"
        style={{ height: CHART_HEIGHT }}
      />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {Array.from({ length: seriesCount }, (_unused, index) => (
          <Skeleton key={index} className="h-3 w-20" />
        ))}
      </div>
    </Panel>
  );
}
