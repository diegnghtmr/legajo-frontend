import { useTranslation } from 'react-i18next';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { Badge } from '../../shared/components/ui/badge';
import { cn } from '../../shared/lib/cn';
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
  /** Opens `algorithmId`'s trace in the workbench's detail panel without
   * navigating away from this table (the row is the trace trigger, §6.2).
   * The caller already knows the compared pair (it is the one that fetched
   * these rows), so building the trace destination from it lives there,
   * never re-derived here from a documentIdA/documentIdB prop this table
   * would otherwise carry only to hand straight back unchanged. */
  onOpenTrace: (algorithmId: string) => void;
  /** The algorithm id whose trace is currently open, if any — marks that
   * one row `aria-current` with a 2px inset marker; never more than one. */
  openAlgorithmId?: string | null;
}

/**
 * The six-capability comparison table, on the shadcn `Table` primitive. A
 * plain semantic table instead of TanStack Table: there is no sorting,
 * filtering, or pagination requirement for a fixed, small (≤6) row set, so
 * the extra dependency and column-definition ceremony would not simplify
 * anything here — it would only add indirection over a table that never
 * needs it.
 *
 * Each row is its own trace trigger: one `<button>` whose accessible name is
 * the mono algorithm id, stretched to the row's full hit area (`relative` on
 * `TableRow`, `absolute inset-0` on the button — the button's positioned
 * ancestor is the row, not just the cell it visually sits in, per CSS
 * containing-block resolution through static ancestors). Activating it opens
 * the trace in the detail panel and keeps this table mounted — the row
 * never navigates away from it. The catalogue's `displayName` sits in a
 * decorative paragraph next to the button, not inside its accessible name.
 */
export function CompareTable({
  rows,
  catalogueById,
  onOpenTrace,
  openAlgorithmId = null,
}: CompareTableProps) {
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
          const isOpen = openAlgorithmId === algorithmId;

          return (
            <TableRow
              key={algorithmId}
              aria-current={isOpen ? 'true' : undefined}
              className={cn(
                'relative',
                isOpen &&
                  "before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-ink before:content-['']",
              )}
            >
              <TableHead
                scope="row"
                className="relative text-left text-body font-normal normal-case tracking-normal text-ink"
              >
                {/* The row's single trace trigger: a stretched hit area
                 * (`absolute inset-0`, sized against the `relative` row
                 * above, not just this cell) per §6.2 ("the hit area spans
                 * the row"). It carries no text of its own — `aria-labelledby`
                 * borrows the mono id span's name instead, the same pattern
                 * `SelectionRail`'s checkbox uses for its title — so the
                 * visible id and `displayName` stay normal, unhidden text
                 * (each still contributes to the row's own accessible name)
                 * while every pointer event still reaches the button
                 * underneath them (`pointer-events-none` on both). */}
                <button
                  type="button"
                  onClick={() => onOpenTrace(algorithmId)}
                  aria-labelledby={`compare-row-algo-${algorithmId}`}
                  className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
                <span
                  id={`compare-row-algo-${algorithmId}`}
                  className="pointer-events-none relative z-10 font-mono text-mono text-ink"
                >
                  {algorithmId}
                </span>
                {summary && (
                  <p className="pointer-events-none relative z-10 text-label text-ink-muted">
                    {summary.displayName}
                  </p>
                )}
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
