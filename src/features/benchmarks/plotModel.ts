import { mergeSeriesIntoRows, type FamilySeries } from './grouping';
import { logDecadeTicks } from './logDecadeTicks';
import { theoreticalCurvePoints } from './theoreticalCurve';

export type Scale = 'linear' | 'log-log';

export interface FamilySlope {
  empiricalSlope: number;
  theoreticalExponent: number;
}

/** A lower and an upper arm, relative to the plotted value (Recharts' asymmetric error format). */
export type ErrorArms = readonly [number, number];

/** One x position: `size`, one value per family, and the derived
 * `<family>__theoretical` / `<family>__error` entries. */
export type PlotRow = { size: number } & Record<string, number | ErrorArms>;

export interface PlotModel {
  rows: PlotRow[];
  /** Powers of ten on the log scale; empty (automatic ticks) on the linear one. */
  yTicks: number[];
  yDomain: [number | 'auto', number | 'auto'];
}

/** Half a decade in log space: the padding below and above the outermost tick. */
const HALF_DECADE = Math.sqrt(10);

export function theoreticalKey(family: string): string {
  return `${family}__theoretical`;
}

export function errorKey(family: string): string {
  return `${family}__error`;
}

/**
 * The error arms of one point, with the lower one clipped so the whisker
 * never crosses the axis floor (a log axis has no zero or negative side).
 */
export function whiskerBounds(valueNs: number, errorNs: number, floorNs: number): ErrorArms {
  return [Math.min(errorNs, Math.max(valueNs - floorNs, 0)), errorNs];
}

/**
 * A log axis has no representation for zero or a negative value (`Math.log`
 * of either is `-Infinity`/`NaN`), which breaks Recharts' domain calculation
 * for the *entire* chart, not just the offending point. On `log-log`, such
 * points are excluded from the plotted series; they stay in the sr-only data
 * table, which always reflects every raw measured value regardless of scale.
 */
function seriesForPlotting(series: readonly FamilySeries[], scale: Scale): FamilySeries[] {
  if (scale !== 'log-log') {
    return [...series];
  }
  return series.map((entry) => ({
    family: entry.family,
    points: entry.points.filter((point) => point.size > 0 && point.valueNs > 0),
  }));
}

function isPlainValue(entry: [string, number | ErrorArms]): entry is [string, number] {
  return entry[0] !== 'size' && typeof entry[1] === 'number';
}

/**
 * Everything the chart draws, derived once per scale: the merged rows
 * (measured value, theoretical curve, error arms), and on the log scale the
 * decade ticks and domain. Recharts' own automatic log ticks land on
 * arbitrary sub-multiples of the domain, never true decades, so the ticks
 * (and a matching, half-decade-padded domain that keeps the lowest tick
 * clear of the x-axis's first label) are computed from every value actually
 * plotted, including the theoretical curves and the upper whiskers.
 */
export function buildPlotModel(
  series: readonly FamilySeries[],
  slopes: ReadonlyMap<string, FamilySlope>,
  scale: Scale,
): PlotModel {
  const plotted = seriesForPlotting(series, scale);
  const rowsBySize = new Map<number, PlotRow>(
    mergeSeriesIntoRows(plotted).map((row) => [row.size, { ...row } as PlotRow]),
  );

  for (const { family, points } of plotted) {
    const slope = slopes.get(family);
    if (!slope) {
      continue;
    }
    for (const point of theoreticalCurvePoints(points, slope.theoreticalExponent)) {
      const row = rowsBySize.get(point.size) ?? ({ size: point.size } as PlotRow);
      row[theoreticalKey(family)] = point.valueNs;
      rowsBySize.set(point.size, row);
    }
  }

  const rows = [...rowsBySize.values()].sort((a, b) => a.size - b.size);

  const upperValues = plotted.flatMap(({ points }) =>
    points.map((point) => point.valueNs + point.errorNs),
  );
  const yTicks =
    scale === 'log-log'
      ? logDecadeTicks([
          ...rows.flatMap((row) =>
            Object.entries(row)
              .filter(isPlainValue)
              .map(([, value]) => value),
          ),
          ...upperValues,
        ])
      : [];
  const yDomain: PlotModel['yDomain'] =
    yTicks.length > 0
      ? [yTicks[0]! / HALF_DECADE, yTicks[yTicks.length - 1]! * HALF_DECADE]
      : ['auto', 'auto'];
  const floorNs = typeof yDomain[0] === 'number' ? yDomain[0] : 0;

  for (const { family, points } of plotted) {
    for (const point of points) {
      if (point.errorNs > 0) {
        rowsBySize.get(point.size)![errorKey(family)] = whiskerBounds(
          point.valueNs,
          point.errorNs,
          floorNs,
        );
      }
    }
  }

  return { rows, yTicks, yDomain };
}
