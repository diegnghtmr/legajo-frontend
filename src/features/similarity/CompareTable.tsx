import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { Badge } from '../../shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shared/components/ui/table';
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
 * The six-capability comparison table, on the shadcn `Table` primitive. A
 * plain semantic table instead of TanStack Table: there is no sorting,
 * filtering, or pagination requirement for a fixed, small (≤6) row set, so
 * the extra dependency and column-definition ceremony would not simplify
 * anything here — it would only add indirection over a table that never
 * needs it. The algorithm id cell keeps its own `<th scope="row">` markup
 * (a `TableHead` restyled to a body cell) since `TableCell` only renders a
 * `<td>`, and this row needs the semantic row-header role.
 */
export function CompareTable({ rows, catalogueById, documentIdA, documentIdB }: CompareTableProps) {
  const { t, i18n } = useTranslation();

  return (
    <Table>
      <TableCaption className="sr-only">{t('similarity.table.caption')}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('similarity.table.algorithm')}</TableHead>
          <TableHead>{t('similarity.table.family')}</TableHead>
          <TableHead>{t('similarity.table.score')}</TableHead>
          <TableHead>{t('similarity.table.raw')}</TableHead>
          <TableHead>{t('similarity.table.time')}</TableHead>
          <TableHead>{t('similarity.table.degenerate')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ algorithmId, result }) => {
          const summary = catalogueById.get(algorithmId);
          const family = algoFamilyFromKind(summary?.kind ?? 'CLASSIC');
          const familyLabel =
            family === 'classic' ? t('similarity.family.classic') : t('similarity.family.ai');
          const formattedRaw = formatRawValue(result.rawValue);

          return (
            <TableRow key={algorithmId}>
              <TableHead
                scope="row"
                className="text-left text-body font-normal normal-case tracking-normal text-ink"
              >
                <Link
                  to={`/similarity/${encodeURIComponent(algorithmId)}/trace?documentIdA=${encodeURIComponent(documentIdA)}&documentIdB=${encodeURIComponent(documentIdB)}`}
                  className="font-mono text-mono text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {algorithmId}
                </Link>
                {summary && <p className="text-label text-ink-muted">{summary.displayName}</p>}
              </TableHead>
              <TableCell>
                <FamilyStatus family={family} label={familyLabel} />
              </TableCell>
              <TableCell>
                <ScoreBar
                  value={result.normalizedScore}
                  family={family}
                  label={t('similarity.table.scoreLabel', { id: algorithmId })}
                />
              </TableCell>
              <TableCell className="font-mono text-mono text-ink-muted">
                {formattedRaw === null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">{t('similarity.table.rawUnavailable')}</span>
                  </>
                ) : (
                  formattedRaw
                )}
              </TableCell>
              <TableCell className="font-mono text-mono text-ink">
                {formatComputedNanos(result.computedNanos, i18n.language)}
                {result.cached && (
                  <Badge className="ml-2 rounded-sm border-ink px-1 py-0 text-[10px] font-semibold uppercase tracking-wide text-ink">
                    {t('similarity.table.cachedMarker')}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-label text-ink-secondary">
                {result.degenerate
                  ? t('similarity.table.degenerateYes')
                  : t('similarity.table.degenerateNo')}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
