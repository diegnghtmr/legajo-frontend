import { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { Badge } from '../../shared/components/ui/badge';
import { FamilyStatus } from '../../shared/components/FamilyStatus';
import { algoFamilyFromKind } from './algorithmFamily';
import { formatComputedNanos, formatRawValue } from './formatters';
import { rememberTraceTrigger } from './traceFocusReturn';

type AlgorithmSummary = ListSimilarityAlgorithmsResponse[number];

export interface CompareResultsListProps {
  rows: CompareResponse;
  catalogueById: ReadonlyMap<string, AlgorithmSummary>;
  /** Opens `algorithmId`'s trace as the full-height sheet (DESIGN §6.7),
   * the same callback `SimilarityCompareView` already builds for
   * `CompareTable` at `lg`+ — a row here never navigates anywhere else. */
  onOpenTrace: (algorithmId: string) => void;
  /** The algorithm id whose trace is currently open, if any. */
  openAlgorithmId?: string | null;
}

/**
 * The below-`lg` results list (DESIGN §6.7): the same six results
 * `CompareTable` renders as a table from `lg` up, here as a plain list of
 * ≥44px row buttons — family dot, mono id, score and a chevron on one line,
 * a quiet second line for the raw value and the computed time with its
 * `cached` marker, so no pairwise column is lost. Each row is its own trace
 * trigger, exactly like `CompareTable`'s row.
 */
export function CompareResultsList({
  rows,
  catalogueById,
  onOpenTrace,
  openAlgorithmId = null,
}: CompareResultsListProps) {
  const { t } = useTranslation();
  return (
    <ul
      aria-label={t('similarity.table.caption')}
      className="flex flex-col divide-y divide-hairline"
    >
      {rows.map(({ algorithmId, result }) => (
        <CompareResultsListRow
          key={algorithmId}
          algorithmId={algorithmId}
          result={result}
          summary={catalogueById.get(algorithmId)}
          isOpen={openAlgorithmId === algorithmId}
          onOpenTrace={onOpenTrace}
        />
      ))}
    </ul>
  );
}

interface CompareResultsListRowProps {
  algorithmId: string;
  result: CompareResponse[number]['result'];
  summary: AlgorithmSummary | undefined;
  isOpen: boolean;
  onOpenTrace: (algorithmId: string) => void;
}

function CompareResultsListRow({
  algorithmId,
  result,
  summary,
  isOpen,
  onOpenTrace,
}: CompareResultsListRowProps) {
  const { t, i18n } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const family = algoFamilyFromKind(summary?.kind ?? 'CLASSIC');
  const familyLabel =
    family === 'classic' ? t('similarity.family.classic') : t('similarity.family.ai');
  const formattedRaw = formatRawValue(result.rawValue);

  function activateTrace() {
    rememberTraceTrigger(triggerRef.current);
    onOpenTrace(algorithmId);
  }

  return (
    <li>
      <button
        ref={triggerRef}
        type="button"
        aria-current={isOpen ? 'true' : undefined}
        aria-labelledby={`compare-list-algo-${algorithmId}`}
        onClick={activateTrace}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <FamilyStatus family={family} label={familyLabel} hideLabel />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center justify-between gap-2">
            <span id={`compare-list-algo-${algorithmId}`} className="font-mono text-mono text-ink">
              {algorithmId}
            </span>
            <span className="font-mono text-mono text-ink-secondary">
              {result.normalizedScore.toFixed(3)}
            </span>
          </span>
          <span className="flex items-center gap-2 text-label text-ink-muted">
            <span className="font-mono">
              {formattedRaw === null ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">{t('similarity.table.rawUnavailable')}</span>
                </>
              ) : (
                formattedRaw
              )}
            </span>
            <span className="font-mono">
              {formatComputedNanos(result.computedNanos, i18n.language)}
            </span>
            {result.cached && (
              <Badge className="rounded-sm border-ink px-1 py-0 text-[10px] font-semibold uppercase tracking-wide text-ink">
                {t('similarity.table.cachedMarker')}
              </Badge>
            )}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
      </button>
    </li>
  );
}
