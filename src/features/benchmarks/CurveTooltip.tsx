import type { FamilySeries } from './grouping';
import { errorKey, type PlotRow } from './plotModel';
import { hueForIndex } from './seriesStyle';
import { formatDuration } from './units';

export interface CurveTooltipProps {
  /** The plot row under the crosshair; nothing renders while there is none. */
  row: PlotRow | undefined;
  series: readonly FamilySeries[];
  xAxisLabel: string;
  /** The series isolated through the legend, if any: the others recede. */
  isolatedFamily: string | null;
}

const RECEDED_OPACITY = 0.4;

/**
 * The crosshair tooltip: the hovered (or keyboard-focused) size, then every
 * series measured at it, each with its hue sample, mono id, duration and JMH
 * `± error`. Ink surface, above the chart, and it never takes the pointer.
 */
export function CurveTooltip({ row, series, xAxisLabel, isolatedFamily }: CurveTooltipProps) {
  if (!row) {
    return null;
  }

  return (
    <div
      role="tooltip"
      aria-label={`${xAxisLabel} ${row.size}`}
      className="pointer-events-none flex min-w-[140px] max-w-[280px] flex-col gap-1 rounded-md bg-ink px-2.5 py-2 text-label text-primary-foreground shadow-pop"
    >
      <div className="flex justify-between gap-4 font-mono text-mono">
        <span className="text-primary-foreground/70">{xAxisLabel}</span>
        <span>{row.size}</span>
      </div>
      {series.map((entry, index) => {
        const value = row[entry.family];
        if (typeof value !== 'number') {
          return null;
        }
        const arms = row[errorKey(entry.family)];
        const error = typeof arms === 'object' ? arms[1] : undefined;
        return (
          <div
            key={entry.family}
            data-family={entry.family}
            className="flex justify-between gap-4 font-mono text-mono"
            style={{
              opacity:
                isolatedFamily === null || isolatedFamily === entry.family ? 1 : RECEDED_OPACITY,
            }}
          >
            <span className="flex items-center gap-1.5">
              <span
                data-testid={`tooltip-hue-${entry.family}`}
                aria-hidden="true"
                className="h-0.5 w-2 shrink-0"
                style={{ background: hueForIndex(index) }}
              />
              {entry.family}
            </span>
            <span>
              {formatDuration(value)}
              {error !== undefined && (
                <span className="text-primary-foreground/70"> ± {formatDuration(error)}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
