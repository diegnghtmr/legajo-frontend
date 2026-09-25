import { CartesianGrid, Line, LineChart, XAxis, YAxis, type DotItemDotProps } from 'recharts';
import { useTranslation } from 'react-i18next';

import { Panel, PanelHeader } from '../../shared/components/Panel';
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

const CHART_WIDTH = 640;
const CHART_HEIGHT = 280;
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

  return (
    <Panel>
      <PanelHeader title={title} />

      <div
        role="group"
        aria-label={title}
        data-scale={axisScale}
        className="overflow-x-auto"
        style={{ width: CHART_WIDTH, maxWidth: '100%' }}
      >
        <LineChart
          width={CHART_WIDTH}
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
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -12 }}
            className="text-mono"
          />
          <YAxis
            type="number"
            scale={axisScale}
            domain={['auto', 'auto']}
            tickFormatter={(value: number) => formatDuration(value)}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
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
      </div>

      {familiesWithSlopes.length > 0 && (
        <Table aria-label={slopeTableCaption} className="mt-3">
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
      )}

      <Table aria-label={dataTableCaption} className="sr-only">
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
