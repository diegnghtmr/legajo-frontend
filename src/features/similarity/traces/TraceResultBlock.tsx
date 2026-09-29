import type { ReactNode } from 'react';
import { useId, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import type { CompareResponse } from '../../../infrastructure/api/similarity';
import { algorithmsQueryOptions } from '../../../infrastructure/api/similarityCatalogue';
import type { AlgoFamily } from '../../../shared/family';
import { Badge } from '../../../shared/components/ui/badge';
import { cardSurfaceClassName } from '../../../shared/components/ui/card';
import { Skeleton } from '../../../shared/components/ui/skeleton';
import { cn } from '../../../shared/lib/cn';
import { staggerStyle } from '../../../shared/lib/stagger';
import { algoFamilyFromKind, type AlgorithmKind } from '../algorithmFamily';
import { parseAlgorithmIds } from '../algorithmSelection';
import { compareQueryOptions, singleCompareQueryOptions } from '../compareQueryOptions';
import { formatComputedNanos, formatRawValue } from '../formatters';
import { rankResults, type RankedResult } from '../traceRanking';

type Result = CompareResponse[number]['result'];

const TILE_LABEL_CLASS = 'text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary';
const LARGE_VALUE_CLASS = 'font-mono text-title font-semibold leading-7 text-ink';
/** One line of a placeholder value at the tile's large-value size. */
const LARGE_VALUE_PLACEHOLDER = 'h-7 w-[8ch]';
/** One badge tall (`Badge` marker is 20px). */
const MARKER_LINE_CLASS = 'flex h-5 items-center';

function ResultTile({
  label,
  index,
  children,
}: {
  label: string;
  index: number;
  children: ReactNode;
}) {
  return (
    <div
      style={staggerStyle(index)}
      className={cn(cardSurfaceClassName, 'enter-rise flex min-w-0 flex-col gap-1 p-3')}
    >
      <dt className={TILE_LABEL_CLASS}>{label}</dt>
      <dd className="flex min-w-0 flex-col gap-1.5">{children}</dd>
    </div>
  );
}

/** The four tiles' labels, shared by the loaded block and its skeleton. */
function useTileLabels() {
  const { t } = useTranslation();
  return {
    score: t('similarity.trace.result.score'),
    raw: t('similarity.table.raw'),
    time: t('similarity.table.time'),
    degenerate: t('similarity.table.degenerate'),
  };
}

function ScoreTile({
  result,
  family,
  algorithmId,
  rank,
  label,
}: {
  result: Result;
  family: AlgoFamily;
  algorithmId: string;
  /** `pending` while the selection's comparison is still loading; `null` when it cannot place this row. */
  rank: { rank: number; count: number } | 'pending' | null;
  label: string;
}) {
  const { t } = useTranslation();
  const formatted = result.normalizedScore.toFixed(3);
  return (
    <ResultTile label={label} index={0}>
      <div className={LARGE_VALUE_CLASS}>{formatted}</div>
      <div
        role="meter"
        aria-label={t('similarity.table.scoreLabel', { id: algorithmId })}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={result.normalizedScore}
        aria-valuetext={formatted}
        className="h-[6px] overflow-hidden rounded-full bg-paper-sunken"
      >
        <div
          className={cn(
            'enter-grow h-full rounded-full',
            family === 'classic' ? 'bg-classic' : 'bg-ai',
          )}
          style={{ width: `${result.normalizedScore * 100}%` }}
        />
      </div>
      {rank === 'pending' ? (
        <Skeleton className="h-[1lh] w-[12ch] text-label" />
      ) : (
        rank && (
          <p className="text-label text-ink-muted">
            {t('similarity.trace.result.rank', { rank: rank.rank, count: rank.count })}
          </p>
        )
      )}
    </ResultTile>
  );
}

/**
 * The compact summary of the open row that sits above a trace: the normalized
 * score with its rank, the raw value, the time and the degenerate flag. Every
 * value comes from the compare responses the screen already holds or shares a
 * cache entry with; the rank is a reading of the backend's `normalizedScore`
 * order among the rows the table shows. It never replaces the trace below it.
 */
export function TraceResultBlock({
  algorithmId,
  documentIdA,
  documentIdB,
}: {
  algorithmId: string;
  documentIdA: string;
  documentIdB: string;
}) {
  const { t, i18n } = useTranslation();
  const labels = useTileLabels();
  const [searchParams] = useSearchParams();
  const selectedIds = useMemo(
    () => parseAlgorithmIds(searchParams.get('algorithms')),
    [searchParams],
  );

  const algorithmsQuery = useQuery(algorithmsQueryOptions);
  const singleQuery = useQuery(singleCompareQueryOptions(documentIdA, documentIdB, algorithmId));
  const selectionQuery = useQuery({
    ...compareQueryOptions(documentIdA, documentIdB, selectedIds),
    enabled: selectedIds.length > 0,
  });

  const ownRow = selectionQuery.data?.find((row) => row.algorithmId === algorithmId);
  const result = ownRow?.result ?? singleQuery.data?.[0]?.result;
  const summary = algorithmsQuery.data?.find((algorithm) => algorithm.id === algorithmId);

  const resultPending = result === undefined && (singleQuery.isPending || selectionQuery.isPending);
  if (algorithmsQuery.isPending || resultPending) {
    return <TraceResultBlockSkeleton rowCount={selectedIds.length} />;
  }
  if (result === undefined) {
    return null;
  }

  const catalogueKind = new Map<string, AlgorithmKind>(
    (algorithmsQuery.data ?? []).map((algorithm) => [algorithm.id, algorithm.kind]),
  );
  const family = algoFamilyFromKind(summary?.kind ?? 'CLASSIC');
  const ranked = selectionQuery.data ? rankResults(selectionQuery.data) : [];
  const own = ranked.find((entry) => entry.algorithmId === algorithmId);
  const selectionPending = selectionQuery.isPending && selectedIds.length > 0;
  const rank = selectionPending ? 'pending' : own ? { rank: own.rank, count: ranked.length } : null;
  const formattedRaw = formatRawValue(result.rawValue);

  return (
    <div data-testid="trace-result-block" className="flex flex-col gap-4">
      <section aria-label={t('similarity.trace.result.label')}>
        <dl className="grid grid-cols-2 gap-2">
          <ScoreTile
            result={result}
            family={family}
            algorithmId={algorithmId}
            rank={rank}
            label={labels.score}
          />
          <ResultTile label={labels.raw} index={1}>
            {formattedRaw === null ? (
              <>
                <div className={LARGE_VALUE_CLASS}>—</div>
                <p className="text-label text-ink-muted">{t('similarity.table.rawUnavailable')}</p>
              </>
            ) : (
              <div className={cn(LARGE_VALUE_CLASS, 'break-words')}>{formattedRaw}</div>
            )}
          </ResultTile>
          <ResultTile label={labels.time} index={2}>
            <div className={LARGE_VALUE_CLASS}>
              {formatComputedNanos(result.computedNanos, i18n.language)}
            </div>
            {/* The marker's line is reserved whether or not the result is
             * cached, so a narrow tile never grows when it appears. */}
            <div className={MARKER_LINE_CLASS}>
              {result.cached && (
                <Badge variant="marker" className="whitespace-nowrap">
                  {t('similarity.table.cachedMarker')}
                </Badge>
              )}
            </div>
          </ResultTile>
          <ResultTile label={labels.degenerate} index={3}>
            <div className="text-title font-semibold leading-7 text-ink">
              {result.degenerate
                ? t('similarity.table.degenerateYes')
                : t('similarity.table.degenerateNo')}
            </div>
          </ResultTile>
        </dl>
      </section>
      {selectionPending && selectedIds.length > 1 && (
        <TraceRankingSkeleton rowCount={selectedIds.length} />
      )}
      {ranked.length > 1 && (
        <TraceRanking
          ranked={ranked}
          openAlgorithmId={algorithmId}
          familyOf={(id) => algoFamilyFromKind(catalogueKind.get(id) ?? 'CLASSIC')}
        />
      )}
    </div>
  );
}

const RANKING_ROW_CLASS =
  'grid h-7 grid-cols-[1.25rem_minmax(0,11rem)_minmax(0,1fr)_3.5rem] items-center gap-x-3 rounded-sm px-2';

function RankingHeading({ id }: { id: string }) {
  const { t } = useTranslation();
  return (
    <h3 id={id} className={TILE_LABEL_CLASS}>
      {t('similarity.trace.result.ranking')}
    </h3>
  );
}

/** Every visible result on one list, best first: rank, mono id, a bar in the
 * family colour (dimmed for every row but the open one) and the score. Rows
 * are text, not controls; the table above is where a row is opened. */
function TraceRanking({
  ranked,
  openAlgorithmId,
  familyOf,
}: {
  ranked: readonly RankedResult[];
  openAlgorithmId: string;
  familyOf: (algorithmId: string) => AlgoFamily;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <RankingHeading id={headingId} />
      <ol className="flex flex-col">
        {ranked.map(({ algorithmId, normalizedScore, rank }, index) => {
          const isOpen = algorithmId === openAlgorithmId;
          return (
            <li
              key={algorithmId}
              aria-current={isOpen ? 'true' : undefined}
              className={cn(RANKING_ROW_CLASS, isOpen && 'bg-paper-sunken')}
            >
              <span className="text-right font-mono text-mono text-ink-muted">{rank}</span>
              <span className="truncate font-mono text-mono text-ink">{algorithmId}</span>
              <span
                aria-hidden="true"
                className="h-[6px] overflow-hidden rounded-full bg-paper-sunken"
              >
                <span
                  data-rank-fill=""
                  style={{ ...staggerStyle(index), width: `${normalizedScore * 100}%` }}
                  className={cn(
                    'enter-grow block h-full rounded-full',
                    familyOf(algorithmId) === 'classic' ? 'bg-classic' : 'bg-ai',
                    !isOpen && 'opacity-55',
                  )}
                />
              </span>
              <span className="text-right font-mono text-mono text-ink">
                {normalizedScore.toFixed(3)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The ranking's box before the results arrive: the real heading and one
 * placeholder row per algorithm being compared. */
function TraceRankingSkeleton({ rowCount }: { rowCount: number }) {
  const headingId = useId();
  return (
    <section
      data-testid="trace-ranking-skeleton"
      aria-hidden="true"
      className="flex flex-col gap-1"
    >
      <RankingHeading id={headingId} />
      <ul className="flex flex-col">
        {Array.from({ length: rowCount }, (_unused, index) => (
          <li key={index} className={RANKING_ROW_CLASS}>
            <Skeleton className="ml-auto h-3 w-3" />
            <Skeleton className="h-3 w-[14ch]" />
            <Skeleton className="h-[6px] w-full rounded-full" />
            <Skeleton className="ml-auto h-3 w-[5ch]" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The block's box before its values arrive: the four real labels, each value
 * a placeholder at the size it takes, so the swap shifts nothing. */
export function TraceResultBlockSkeleton({ rowCount = 0 }: { rowCount?: number }) {
  const labels = useTileLabels();
  return (
    <div
      data-testid="trace-result-block-skeleton"
      aria-hidden="true"
      className="flex flex-col gap-4"
    >
      <dl className="grid grid-cols-2 gap-2">
        <ResultTile label={labels.score} index={0}>
          <Skeleton className={LARGE_VALUE_PLACEHOLDER} />
          <Skeleton className="h-[6px] w-full rounded-full" />
          <Skeleton className="h-[1lh] w-[12ch] text-label" />
        </ResultTile>
        <ResultTile label={labels.raw} index={1}>
          <Skeleton className={LARGE_VALUE_PLACEHOLDER} />
        </ResultTile>
        <ResultTile label={labels.time} index={2}>
          <Skeleton className={LARGE_VALUE_PLACEHOLDER} />
          <div className={MARKER_LINE_CLASS} />
        </ResultTile>
        <ResultTile label={labels.degenerate} index={3}>
          <Skeleton className="h-7 w-[3ch]" />
        </ResultTile>
      </dl>
      {rowCount > 1 && <TraceRankingSkeleton rowCount={rowCount} />}
    </div>
  );
}
