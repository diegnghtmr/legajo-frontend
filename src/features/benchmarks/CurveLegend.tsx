import { useTranslation } from 'react-i18next';

import { cn } from '../../shared/lib/cn';
import type { FamilySeries } from './grouping';
import { SeriesMarker } from './SeriesMarker';
import { dashPatternForIndex, hueForIndex, markerShapeForIndex } from './seriesStyle';

export interface CurveLegendProps {
  series: readonly FamilySeries[];
  /** Whether at least one series has a theoretical curve to name. */
  showTheoretical: boolean;
  /** Hover or focus on an item isolates its series; leaving restores all of them. */
  onIsolate: (family: string | null) => void;
}

const SWATCH_WIDTH = 28;
const SWATCH_HEIGHT = 10;

/**
 * The series key. Each item pairs a swatch (the series' dash, marker and hue)
 * with its mono id, and is a plain focusable button so hovering or focusing it
 * can isolate that series in the chart. It carries no pressed state: isolation
 * is a transient preview, not something the reader turned on.
 */
export function CurveLegend({ series, showTheoretical, onIsolate }: CurveLegendProps) {
  const { t } = useTranslation();

  return (
    <ul aria-label={t('benchmarks.curves.legend')} className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
      {series.map((entry, index) => {
        const dash = dashPatternForIndex(index) || undefined;
        const hue = hueForIndex(index);
        return (
          <li key={entry.family}>
            <button
              type="button"
              onMouseEnter={() => onIsolate(entry.family)}
              onMouseLeave={() => onIsolate(null)}
              onFocus={() => onIsolate(entry.family)}
              onBlur={() => onIsolate(null)}
              className={cn(
                'flex items-center gap-2 rounded-btn px-2 py-1 font-mono text-mono text-ink',
                'hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                'pointer-coarse:min-h-11',
              )}
            >
              <svg
                data-testid={`legend-swatch-${entry.family}`}
                aria-hidden="true"
                width={SWATCH_WIDTH}
                height={SWATCH_HEIGHT}
                className="shrink-0"
              >
                <line
                  data-testid={`legend-dash-${entry.family}`}
                  x1="0"
                  y1={SWATCH_HEIGHT / 2}
                  x2={SWATCH_WIDTH}
                  y2={SWATCH_HEIGHT / 2}
                  stroke={hue}
                  strokeWidth="1.5"
                  strokeDasharray={dash}
                />
                <SeriesMarker
                  shape={markerShapeForIndex(index)}
                  cx={SWATCH_WIDTH / 2}
                  cy={SWATCH_HEIGHT / 2}
                  radius={3}
                  fill={hue}
                  tagged={false}
                />
              </svg>
              {entry.family}
            </button>
          </li>
        );
      })}
      {showTheoretical && (
        <li className="flex items-center gap-2 px-2 py-1 font-mono text-mono text-ink-secondary">
          <svg aria-hidden="true" width={SWATCH_WIDTH} height={SWATCH_HEIGHT} className="shrink-0">
            <line
              x1="0"
              y1={SWATCH_HEIGHT / 2}
              x2={SWATCH_WIDTH}
              y2={SWATCH_HEIGHT / 2}
              stroke="var(--color-chart-theoretical)"
              strokeDasharray="2 3"
            />
          </svg>
          {t('benchmarks.curves.legendTheoretical')}
        </li>
      )}
    </ul>
  );
}
