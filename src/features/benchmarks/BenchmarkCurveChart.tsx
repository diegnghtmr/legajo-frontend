import { useState } from 'react';
import {
  CartesianGrid,
  ErrorBar,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  type ActiveDotProps,
  type DotItemDotProps,
} from 'recharts';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../shared/components/EmptyState';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { useElementWidth } from '../../shared/hooks/useElementWidth';
import { cn } from '../../shared/lib/cn';
import { readMotionDurationMs } from '../../shared/lib/motionDuration';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shared/components/ui/table';
import { CurveLegend } from './CurveLegend';
import { CurveTooltip } from './CurveTooltip';
import { mergeSeriesIntoRows, type FamilySeries } from './grouping';
import {
  buildPlotModel,
  errorKey,
  type PlotRow,
  theoreticalKey,
  type FamilySlope,
  type Scale,
} from './plotModel';
import { SeriesMarker } from './SeriesMarker';
import {
  dashPatternForIndex,
  hueForIndex,
  markerShapeForIndex,
  type MarkerShape,
} from './seriesStyle';
import { formatDuration } from './units';

export type { FamilySlope };

export interface BenchmarkCurveChartProps {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  series: readonly FamilySeries[];
  slopes: ReadonlyMap<string, FamilySlope>;
  scale: Scale;
  dataTableCaption: string;
  slopeTableCaption: string;
}

/** Exported so this chart's own loading skeleton reserves exactly this
 * height, causing no shift once the real chart replaces it. */
export const CHART_HEIGHT = 280;
/** Series that are not isolated recede to this opacity. */
const DIMMED_OPACITY = 0.12;
const ACTIVE_MARKER_RADIUS = 5;
const LINE_WIDTH = 1.5;
const ISOLATED_LINE_WIDTH = 2.25;
const THEORETICAL_OPACITY = 0.45;
const WHISKER_OPACITY = 0.6;
/** Recharts extends the cap this far to each side of the bar: 6px caps in total. */
const WHISKER_CAP_HALF_WIDTH = 3;

function formatSlopeNumber(value: number): string {
  return value.toFixed(2);
}

/** Renders one marker per measured point, in the series' shape and hue. */
function seriesDot(shape: MarkerShape, hue: string, opacity: number) {
  return function SeriesDot(props: DotItemDotProps) {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) {
      return null;
    }
    return <SeriesMarker shape={shape} cx={cx} cy={cy} fill={hue} opacity={opacity} />;
  };
}

/** The enlarged, hollow marker at the size under the crosshair. */
function hollowDot(shape: MarkerShape, hue: string, opacity: number) {
  return function HollowDot(props: ActiveDotProps) {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) {
      return null;
    }
    return (
      <SeriesMarker
        shape={shape}
        cx={cx}
        cy={cy}
        radius={ACTIVE_MARKER_RADIUS}
        fill="var(--color-paper-raised)"
        stroke={hue}
        opacity={opacity}
        tagged={false}
      />
    );
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
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [isolatedFamily, setIsolatedFamily] = useState<string | null>(null);
  const [seenScale, setSeenScale] = useState(scale);
  const [hasChangedScale, setHasChangedScale] = useState(false);
  if (seenScale !== scale) {
    setSeenScale(scale);
    setHasChangedScale(true);
  }

  if (series.length === 0) {
    return (
      <Panel>
        <PanelHeader title={title} />
        <EmptyState role="status" title={t('benchmarks.curves.noData')} />
      </Panel>
    );
  }

  const chartData = mergeSeriesIntoRows(series);
  const { rows, yTicks, yDomain } = buildPlotModel(series, slopes, scale);
  const axisScale = scale === 'log-log' ? 'log' : 'linear';
  const familiesWithSlopes = series.filter((entry) => slopes.has(entry.family));

  // Lines, markers and whiskers glide to their new positions over the chart
  // duration token (zero under reduced motion, which turns the animation off).
  const morphMs = readMotionDurationMs('--dur-chart');
  const animation = {
    isAnimationActive: morphMs > 0,
    animationDuration: morphMs,
    animationEasing: 'ease-in-out',
  } as const;

  const opacityOf = (family: string) =>
    isolatedFamily === null || isolatedFamily === family ? 1 : DIMMED_OPACITY;

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
          className={cn('min-w-0 flex-1', hasChangedScale && 'chart-scale-morph')}
        >
          {width === null ? (
            // The width is not measured yet: hold the chart's final height
            // so nothing moves when the drawing arrives, and never draw
            // at a guessed width.
            <div style={{ height: CHART_HEIGHT }} />
          ) : (
            <LineChart
              width={width}
              height={CHART_HEIGHT}
              data={rows}
              accessibilityLayer
              title={title}
              margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
            >
              {/* Keyed by scale so the grid and ticks remount, and fade in
                  (`chart-scale-morph`), when the scale changes. */}
              <CartesianGrid
                key={`grid-${scale}`}
                stroke="var(--color-chart-grid)"
                strokeDasharray="3 3"
              />
              <XAxis
                key={`x-${scale}`}
                dataKey="size"
                type="number"
                scale={axisScale}
                domain={['auto', 'auto']}
                className="text-mono"
              />
              <YAxis
                key={`y-${scale}`}
                type="number"
                scale={axisScale}
                domain={yDomain}
                ticks={yTicks.length > 0 ? yTicks : undefined}
                tickFormatter={(value: number) => formatDuration(value)}
                className="text-mono"
                width={72}
              />
              <Tooltip
                isAnimationActive={false}
                cursor={{ stroke: 'var(--color-ink)', strokeOpacity: 0.25, strokeWidth: 1 }}
                content={({ payload }) => (
                  <CurveTooltip
                    row={payload?.[0]?.payload as PlotRow | undefined}
                    series={series}
                    xAxisLabel={xAxisLabel}
                    isolatedFamily={isolatedFamily}
                  />
                )}
              />
              {familiesWithSlopes.map((entry) => {
                const hue = hueForIndex(series.indexOf(entry));
                return (
                  <Line
                    key={theoreticalKey(entry.family)}
                    className="benchmark-theoretical"
                    dataKey={theoreticalKey(entry.family)}
                    name={`${entry.family} ${t('benchmarks.curves.legendTheoretical')}`}
                    stroke={hue}
                    strokeOpacity={THEORETICAL_OPACITY * opacityOf(entry.family)}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    dot={false}
                    activeDot={false}
                    connectNulls
                    {...animation}
                  />
                );
              })}
              {series.map((entry, index) => {
                const hue = hueForIndex(index);
                const opacity = opacityOf(entry.family);
                return (
                  <Line
                    key={entry.family}
                    className="benchmark-series"
                    dataKey={entry.family}
                    name={entry.family}
                    stroke={hue}
                    strokeOpacity={opacity}
                    strokeWidth={isolatedFamily === entry.family ? ISOLATED_LINE_WIDTH : LINE_WIDTH}
                    strokeDasharray={dashPatternForIndex(index) || undefined}
                    dot={seriesDot(markerShapeForIndex(index), hue, opacity)}
                    activeDot={hollowDot(markerShapeForIndex(index), hue, opacity)}
                    connectNulls
                    {...animation}
                  >
                    <ErrorBar
                      dataKey={errorKey(entry.family)}
                      width={WHISKER_CAP_HALF_WIDTH}
                      stroke={hue}
                      strokeOpacity={WHISKER_OPACITY * opacity}
                      strokeWidth={1}
                      {...animation}
                    />
                  </Line>
                );
              })}
            </LineChart>
          )}
          <p className="mt-1 text-center text-mono text-ink-secondary">{xAxisLabel}</p>
        </div>
      </div>

      <CurveLegend
        series={series}
        showTheoretical={familiesWithSlopes.length > 0}
        onIsolate={setIsolatedFamily}
      />

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
       * `sr-only` on the wrapping `<div>`, never on `Table`'s own `<table>`
       * element: a table generates two boxes, an anonymous "table wrapper
       * box" that takes `position`/`margin`, and the "table box" proper
       * that takes `width`/`height`/`overflow` — so `sr-only`'s own
       * `overflow: hidden` and 1px box would only ever clip the grid of
       * rows/cells, never this table's own `<TableCaption>`, which is laid
       * out as a sibling of the table box *inside* that unclipped wrapper
       * box (verified against a live render: the caption still rendered at
       * its full wrapped size, overlapping the next chart's own section
       * heading below it — same table wrapper-box split
       * `Dendrogram.tsx`'s own merge table already documents). A plain
       * `<div>` has no such wrapper/table split, so `sr-only` clips its
       * whole subtree — caption included — to a single 1x1px box regardless
       * of the table's own layout algorithm, which is also why this no
       * longer needs `Table`'s own `w-px`/`table-fixed`/`whitespace-normal`
       * (the div's own fixed size and `overflow: hidden` already keep this
       * off the page's scrollable width no matter how wide the table would
       * otherwise render) or `wrap`'s default scroll wrapper (`wrap={false}`
       * skips it, since this div is already the only wrapper this table
       * needs).
       */}
      <div className="sr-only">
        <Table aria-label={dataTableCaption} wrap={false}>
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
      </div>
    </Panel>
  );
}

export interface BenchmarkCurveChartSkeletonProps {
  title: string;
  /** Fixed chrome (never response data): the x-axis title below the chart
   * and the y-axis title beside it, the same real text the loaded card
   * shows in the same two places. */
  xAxisLabel: string;
  yAxisLabel: string;
  /** Fixed chrome for the slope table's own accessible name. */
  slopeTableCaption: string;
  /** The group's own fixed family count (e.g. the four pairwise classic
   * algorithms) — already known before the request resolves, unlike the
   * per-size data points themselves. Every fixed family always carries an
   * empirical/theoretical slope, so this also fixes the slope table's own
   * row count, and — since every family id in this fixed list is a static
   * constant, never response data — its own real text for the legend and
   * the slope table's own family column, at that text's own real width
   * (never a shorter guessed bar a longer real id would then wrap past). */
  families: readonly string[];
}

/**
 * Mirrors one `BenchmarkCurveChart` card past the chart itself: the real
 * title, axis titles, chart-height placeholder (at exactly `CHART_HEIGHT`,
 * so the swap causes no shift), the legend row and the slope table's own
 * scroll region — real header row, one placeholder row per known series —
 * which the original skeleton omitted entirely, leaving that whole box
 * height unreserved.
 */
export function BenchmarkCurveChartSkeleton({
  title,
  xAxisLabel,
  yAxisLabel,
  slopeTableCaption,
  families,
}: BenchmarkCurveChartSkeletonProps) {
  const { t } = useTranslation();

  return (
    <Panel>
      <PanelHeader title={title} />

      <div className="flex items-stretch gap-2">
        <span
          className="flex w-5 shrink-0 items-center justify-center whitespace-nowrap text-mono text-ink-secondary"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {yAxisLabel}
        </span>
        <div className="min-w-0 flex-1">
          <Skeleton
            data-testid="benchmark-chart-skeleton"
            className="w-full rounded-md"
            style={{ height: CHART_HEIGHT }}
          />
          <p className="mt-1 text-center text-mono text-ink-secondary">{xAxisLabel}</p>
        </div>
      </div>

      <ul
        aria-label={t('benchmarks.curves.legend')}
        className="mt-3 flex flex-wrap gap-x-2 gap-y-1"
      >
        {families.map((family) => (
          <li
            key={family}
            className="flex items-center gap-2 px-2 py-1 font-mono text-mono text-ink"
          >
            <Skeleton className="h-2.5 w-7 rounded-none" />
            {family}
          </li>
        ))}
        <li className="flex items-center gap-2 px-2 py-1 font-mono text-mono text-ink-secondary">
          <Skeleton className="h-2.5 w-7 rounded-none" />
          {t('benchmarks.curves.legendTheoretical')}
        </li>
      </ul>

      <div className="mt-3 overflow-hidden rounded-md">
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
            {families.map((family) => (
              <TableRow key={family}>
                <TableCell className="font-mono text-mono text-ink">{family}</TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-10" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
