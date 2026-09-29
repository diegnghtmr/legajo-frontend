import { useTranslation } from 'react-i18next';

import { cn } from '../../../shared/lib/cn';
import { MATRIX_HEAT_BUCKETS } from './matrixHeat';

/**
 * The key to the matrix's heat ladder: one swatch and a mono range label for
 * each of the four buckets the cells use. Every cell also prints its own
 * number, so the legend explains the fill and is never the only channel.
 */
export function MatrixHeatLegend() {
  const { t } = useTranslation();
  return (
    <ul
      aria-label={t('similarity.matrix.legend.label')}
      className="flex flex-wrap items-center gap-x-4 gap-y-1"
    >
      {MATRIX_HEAT_BUCKETS.map((bucket) => (
        <li key={bucket.label} className="flex items-center gap-2">
          <span
            data-swatch=""
            aria-hidden="true"
            className={cn('size-4 rounded-sm border border-hairline-strong', bucket.className)}
          />
          <span className="font-mono text-mono text-ink-secondary">{bucket.label}</span>
        </li>
      ))}
    </ul>
  );
}
