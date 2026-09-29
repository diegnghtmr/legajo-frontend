import { useTranslation } from 'react-i18next';

import type { ListSimilarityAlgorithmsResponse } from '../../infrastructure/api/similarity';
import { FamilyStatus } from '../../shared/components/FamilyStatus';
import { buttonVariants } from '../../shared/components/ui/button';
import { Skeleton } from '../../shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shared/components/ui/table';
import { cn } from '../../shared/lib/cn';
import { algoFamilyFromKind } from './algorithmFamily';
import { CompareTableHeaderRow } from './CompareTable';

type AlgorithmSummary = ListSimilarityAlgorithmsResponse[number];

/*
 * Loading placeholders for the compare screen. Everything that is known
 * before the response (the algorithm ids, their display names and families,
 * the header labels) renders as the real text in the real cell components,
 * so widths and wrap points match by construction; only the values the
 * response computes (score, raw value, time, cached marker) hold a
 * placeholder, sized in `ch` for the mono figures so it claims the width the
 * widest realistic value takes.
 */

/** The selectable id row, drawn with the same classes a selectable id takes
 * but inert: no button, so nothing focusable sits inside a skeleton. */
export function AlgorithmListSkeleton({ algorithmIds }: { algorithmIds: readonly string[] }) {
  return (
    <div
      data-testid="algorithm-list-skeleton"
      aria-hidden="true"
      className="flex flex-wrap items-center gap-x-4 gap-y-6"
    >
      {algorithmIds.map((algorithmId) => (
        <span
          key={algorithmId}
          className={cn(buttonVariants({ variant: 'mono' }), 'pointer-events-none')}
        >
          {algorithmId}
        </span>
      ))}
    </div>
  );
}

/** Mono figure placeholders: one line tall, as wide as the widest value. */
const SCORE_PLACEHOLDER = 'h-[1lh] w-[5ch] font-mono text-mono';
const RAW_PLACEHOLDER = 'h-[1lh] w-[6ch] font-mono text-mono';
const TIME_PLACEHOLDER = 'h-[1lh] w-[9ch] font-mono text-mono';
const CACHED_MARKER_PLACEHOLDER = 'h-4 w-[60px]';

/** The row's algorithm and family cells. With the catalogue cached they are
 * the real text; while it is still pending (a cold start whose prefetch has
 * not landed) only the id is known, from the selection itself, so the name
 * and the family hold placeholders of the same line height. */
function CompareTableSkeletonRow({
  algorithmId,
  summary,
}: {
  algorithmId: string;
  summary: AlgorithmSummary | undefined;
}) {
  const { t } = useTranslation();
  const family = summary ? algoFamilyFromKind(summary.kind) : undefined;
  return (
    <TableRow data-testid="compare-table-skeleton-row">
      <TableHead
        scope="row"
        className="text-left text-body font-normal normal-case tracking-normal text-ink"
      >
        <span className="font-mono text-mono text-ink">{algorithmId}</span>
        {summary ? (
          <p className="text-label text-ink-muted">{summary.displayName}</p>
        ) : (
          <Skeleton className="h-[1lh] w-full max-w-[14ch] text-label" />
        )}
      </TableHead>
      <TableCell>
        {family ? (
          <FamilyStatus
            family={family}
            label={
              family === 'classic' ? t('similarity.family.classic') : t('similarity.family.ai')
            }
          />
        ) : (
          <Skeleton className="h-[1lh] w-full max-w-[9ch] text-label" />
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Skeleton className={SCORE_PLACEHOLDER} />
          <Skeleton className="h-[6px] w-24 rounded-full" />
        </div>
      </TableCell>
      <TableCell className="font-mono text-mono">
        <Skeleton className={RAW_PLACEHOLDER} />
      </TableCell>
      <TableCell className="font-mono text-mono">
        <Skeleton className={cn('inline-block align-top', TIME_PLACEHOLDER)} />
        <Skeleton className={cn('ml-2 inline-block align-top', CACHED_MARKER_PLACEHOLDER)} />
      </TableCell>
      <TableCell className="text-label">
        <Skeleton className="h-[1lh] w-[3ch]" />
      </TableCell>
    </TableRow>
  );
}

export function CompareTableSkeleton({
  algorithmIds,
  catalogueById,
}: {
  algorithmIds: readonly string[];
  catalogueById: ReadonlyMap<string, AlgorithmSummary>;
}) {
  return (
    <Table>
      <TableHeader>
        <CompareTableHeaderRow />
      </TableHeader>
      <TableBody>
        {algorithmIds.map((algorithmId) => (
          <CompareTableSkeletonRow
            key={algorithmId}
            algorithmId={algorithmId}
            summary={catalogueById.get(algorithmId)}
          />
        ))}
      </TableBody>
    </Table>
  );
}

/** One `CompareResultsList` row's box: family dot, mono id and score on one
 * line, the quiet raw-value/time/cached line under it, and the chevron. */
function CompareResultsListSkeletonRow({ algorithmId }: { algorithmId: string }) {
  return (
    <li className="flex min-h-11 w-full items-center gap-3 px-3 py-2">
      <Skeleton className="size-[6px] shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-mono text-ink">{algorithmId}</span>
          <Skeleton className={SCORE_PLACEHOLDER} />
        </div>
        <div className="flex items-center gap-4 text-label">
          <Skeleton className={RAW_PLACEHOLDER} />
          <Skeleton className={cn(TIME_PLACEHOLDER, 'w-[12ch]')} />
          <Skeleton className={CACHED_MARKER_PLACEHOLDER} />
        </div>
      </div>
      <Skeleton className="size-4 shrink-0" />
    </li>
  );
}

export function CompareResultsListSkeleton({ algorithmIds }: { algorithmIds: readonly string[] }) {
  return (
    <ul data-testid="compare-list-skeleton" className="flex flex-col divide-y divide-hairline">
      {algorithmIds.map((algorithmId) => (
        <CompareResultsListSkeletonRow key={algorithmId} algorithmId={algorithmId} />
      ))}
    </ul>
  );
}
