import { useRef } from 'react';
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
import { staggerStyle } from '../../shared/lib/stagger';
import { rememberTraceTrigger } from './traceFocusReturn';

type AlgorithmSummary = ListSimilarityAlgorithmsResponse[number];

export interface CompareTableProps {
  rows: CompareResponse;
  catalogueById: ReadonlyMap<string, AlgorithmSummary>;
  /** Opens `algorithmId`'s trace in the workbench's detail panel without
   * navigating away from this table — the row is the trace trigger.
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
 * Each row is its own trace trigger. The accessible control is a single
 * `<button>` whose accessible name is the mono algorithm id, but the hit area
 * is the whole row: the button owns the activation (its own `onClick`,
 * reachable the same way by mouse, touch, and keyboard — a native `<button>`
 * fires a real `click` for both `Enter` and `Space`), and `TableRow` carries
 * a second `onClick` only as a mouse/pointer convenience for the rest of the
 * row's hit area. The button's handler stops the event from bubbling to the
 * row's own, so a click on the button itself only ever runs one handler —
 * never both — while a click anywhere else in the row still reaches the
 * row's own handler through plain DOM event bubbling. This never relies on
 * a `position: relative`/`absolute inset-0` pair to make a cell's box cover
 * the row (that only works when nothing between the two is itself
 * accidentally positioned, and does not need verifying across browsers to
 * begin with). The catalogue's `displayName` sits in a decorative paragraph
 * next to the button, not inside its accessible name.
 */
/** The six-column header row, shared verbatim with the table's own loading
 * skeleton (`SimilarityCompareView`) — a static header stays on screen while
 * only the body swaps between skeleton rows and real ones. */
export function CompareTableHeaderRow() {
  const { t } = useTranslation();
  return (
    <TableRow>
      <TableHead>{t('similarity.table.algorithm')}</TableHead>
      <TableHead>{t('similarity.table.family')}</TableHead>
      <TableHead>{t('similarity.table.score')}</TableHead>
      <TableHead>{t('similarity.table.raw')}</TableHead>
      <TableHead>{t('similarity.table.time')}</TableHead>
      <TableHead>{t('similarity.table.degenerate')}</TableHead>
    </TableRow>
  );
}

export function CompareTable({
  rows,
  catalogueById,
  onOpenTrace,
  openAlgorithmId = null,
}: CompareTableProps) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableCaption className="sr-only">{t('similarity.table.caption')}</TableCaption>
      <TableHeader>
        <CompareTableHeaderRow />
      </TableHeader>
      <TableBody>
        {rows.map(({ algorithmId, result }, index) => (
          <CompareTableRow
            key={algorithmId}
            index={index}
            algorithmId={algorithmId}
            result={result}
            summary={catalogueById.get(algorithmId)}
            isOpen={openAlgorithmId === algorithmId}
            onOpenTrace={onOpenTrace}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface CompareTableRowProps {
  /** The row's place in the staggered entry (rows and score bars). */
  index: number;
  algorithmId: string;
  result: CompareResponse[number]['result'];
  summary: AlgorithmSummary | undefined;
  isOpen: boolean;
  onOpenTrace: (algorithmId: string) => void;
}

/**
 * One result row and its own trace trigger. Kept as its own component (not
 * inlined in `CompareTable`'s `.map`) so it can hold a `ref` to its own
 * button — the exact element `traceFocusReturn` remembers, never a
 * `querySelector('button')` guess at DOM order, which would misidentify the
 * trigger the moment a row ever grew a second button ahead of this one.
 */
function CompareTableRow({
  index,
  algorithmId,
  result,
  summary,
  isOpen,
  onOpenTrace,
}: CompareTableRowProps) {
  const { t, i18n } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const family = algoFamilyFromKind(summary?.kind ?? 'CLASSIC');
  const familyLabel =
    family === 'classic' ? t('similarity.family.classic') : t('similarity.family.ai');
  const formattedRaw = formatRawValue(result.rawValue);

  function activateTrace() {
    rememberTraceTrigger(triggerRef.current, algorithmId);
    onOpenTrace(algorithmId);
  }

  return (
    <TableRow
      aria-current={isOpen ? 'true' : undefined}
      onClick={activateTrace}
      style={staggerStyle(index)}
      className={cn(
        'enter-rise relative cursor-pointer',
        isOpen &&
          "before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-ink before:content-['']",
      )}
    >
      <TableHead
        scope="row"
        className="relative text-left text-body font-normal normal-case tracking-normal text-ink"
      >
        {/* The row's single accessible trigger: keyboard and
         * assistive-technology users tab to and activate this button
         * directly, and it owns opening the trace on its own `onClick`
         * (stopping propagation so the row's own handler below never also
         * runs for the same activation). It carries no text of its own —
         * `aria-labelledby` borrows the mono id span's name instead, the
         * same pattern `SelectionRail`'s checkbox uses for its title — so
         * the visible id and `displayName` stay normal, unhidden text (each
         * still contributes to the row's own accessible name) while every
         * pointer event still reaches the button underneath them
         * (`pointer-events-none` on both). */}
        <button
          ref={triggerRef}
          type="button"
          aria-labelledby={`compare-row-algo-${algorithmId}`}
          data-algorithm-trigger={algorithmId}
          onClick={(event) => {
            event.stopPropagation();
            activateTrace();
          }}
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
          growIndex={index}
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
          <Badge variant="marker" className="-my-0.5 ml-2 whitespace-nowrap align-middle">
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
}
