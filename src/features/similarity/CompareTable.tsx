import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { FamilyStatus } from '../../shared/components/FamilyStatus';
import { ScoreBar } from '../../shared/components/ScoreBar';
import { algoFamilyFromKind } from './algorithmFamily';
import { formatComputedNanos, formatRawValue } from './formatters';

type AlgorithmSummary = ListSimilarityAlgorithmsResponse[number];

export interface CompareTableProps {
  rows: CompareResponse;
  catalogueById: ReadonlyMap<string, AlgorithmSummary>;
  documentIdA: string;
  documentIdB: string;
}

/**
 * The six-capability comparison table. A plain
 * semantic `<table>` instead of TanStack Table: there is no sorting,
 * filtering, or pagination requirement for a fixed, small (≤6) row set, so
 * the extra dependency and column-definition ceremony would not simplify
 * anything here — it would only add indirection over a table that never
 * needs it.
 */
export function CompareTable({ rows, catalogueById, documentIdA, documentIdB }: CompareTableProps) {
  const { t, i18n } = useTranslation();

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{t('similarity.table.caption')}</caption>
      <thead>
        <tr className="bg-paper-sunken">
          <th
            scope="col"
            className="p-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
          >
            {t('similarity.table.algorithm')}
          </th>
          <th
            scope="col"
            className="p-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
          >
            {t('similarity.table.family')}
          </th>
          <th
            scope="col"
            className="p-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
          >
            {t('similarity.table.score')}
          </th>
          <th
            scope="col"
            className="p-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
          >
            {t('similarity.table.raw')}
          </th>
          <th
            scope="col"
            className="p-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
          >
            {t('similarity.table.time')}
          </th>
          <th
            scope="col"
            className="p-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
          >
            {t('similarity.table.degenerate')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ algorithmId, result }) => {
          const summary = catalogueById.get(algorithmId);
          const family = algoFamilyFromKind(summary?.kind ?? 'CLASSIC');
          const familyLabel =
            family === 'classic' ? t('similarity.family.classic') : t('similarity.family.ai');
          const formattedRaw = formatRawValue(result.rawValue);

          return (
            <tr key={algorithmId} className="border-b border-hairline">
              <th scope="row" className="p-2 font-normal">
                <Link
                  to={`/similarity/${encodeURIComponent(algorithmId)}/trace?documentIdA=${encodeURIComponent(documentIdA)}&documentIdB=${encodeURIComponent(documentIdB)}`}
                  className="font-mono text-mono text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {algorithmId}
                </Link>
                {summary && <p className="text-label text-ink-muted">{summary.displayName}</p>}
              </th>
              <td className="p-2">
                <FamilyStatus family={family} label={familyLabel} />
              </td>
              <td className="p-2">
                <ScoreBar
                  value={result.normalizedScore}
                  family={family}
                  label={t('similarity.table.scoreLabel', { id: algorithmId })}
                />
              </td>
              <td className="p-2 font-mono text-mono text-ink-muted">
                {formattedRaw === null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">{t('similarity.table.rawUnavailable')}</span>
                  </>
                ) : (
                  formattedRaw
                )}
              </td>
              <td className="p-2 font-mono text-mono text-ink">
                {formatComputedNanos(result.computedNanos, i18n.language)}
                {result.cached && (
                  <span className="ml-2 rounded-sm border border-ink px-1 text-[10px] font-semibold uppercase tracking-wide text-ink">
                    {t('similarity.table.cachedMarker')}
                  </span>
                )}
              </td>
              <td className="p-2 text-label text-ink-secondary">
                {result.degenerate
                  ? t('similarity.table.degenerateYes')
                  : t('similarity.table.degenerateNo')}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
