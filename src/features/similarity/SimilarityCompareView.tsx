import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  compareSimilarity,
  fetchSimilarityAlgorithms,
  type CompareRequestBody,
  type CompareResponse,
  type ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { AlgorithmIdSchema, type AlgorithmId } from '../../infrastructure/schemas/similarity';
import { PanelHeader } from '../../shared/components/Panel';
import { AlgoTextList } from '../../shared/components/AlgoTextList';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';
import { Skeleton } from '../../shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '../../shared/components/ui/table';
import { useIsAtLeastLg } from '../../shared/lib/useIsAtLeastLg';
import { algoFamilyFromKind } from './algorithmFamily';
import { CompareResultsList } from './CompareResultsList';
import { CompareTable, CompareTableHeaderRow } from './CompareTable';

export const ALGORITHMS_QUERY_KEY = ['similarity', 'algorithms'] as const;

/** The six fixed capability ids, independent of the catalogue fetch. */
const DEFAULT_ALGORITHM_IDS = [...AlgorithmIdSchema.options];

/** The catalogue's real size is unknown before it resolves — six mono bars,
 * one per fixed capability, mirror `AlgoTextList`'s own flex-wrap box. */
const ALGORITHM_LIST_SKELETON_COUNT = 6;

function AlgorithmListSkeleton() {
  return (
    <div
      data-testid="algorithm-list-skeleton"
      className="flex flex-wrap items-center gap-x-4 gap-y-6"
    >
      {Array.from({ length: ALGORITHM_LIST_SKELETON_COUNT }, (_, index) => (
        <Skeleton key={index} className="h-3 w-20" />
      ))}
    </div>
  );
}

/** Mirrors one `CompareTable` result row's five data cells (family, score,
 * raw value, time, degenerate), keeping the real header row visible above
 * it — only the body swaps once the request resolves. */
function CompareTableSkeletonRow() {
  return (
    <TableRow data-testid="compare-table-skeleton-row">
      <TableCell>
        <Skeleton className="h-3.5 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-3 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-3 w-10" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-3 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-3 w-8" />
      </TableCell>
    </TableRow>
  );
}

function CompareTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <Table>
      <TableHeader>
        <CompareTableHeaderRow />
      </TableHeader>
      <TableBody>
        {Array.from({ length: rowCount }, (_, index) => (
          <CompareTableSkeletonRow key={index} />
        ))}
      </TableBody>
    </Table>
  );
}

/** Mirrors one `CompareResultsList` row's box: the family dot, the mono id
 * and score line, and the quiet raw-value/time second line. */
function CompareResultsListSkeletonRow() {
  return (
    <li className="flex min-h-11 w-full items-center gap-3 px-3 py-2">
      <Skeleton className="size-[6px] shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </li>
  );
}

function CompareResultsListSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <ul data-testid="compare-list-skeleton" className="flex flex-col divide-y divide-hairline">
      {Array.from({ length: rowCount }, (_, index) => (
        <CompareResultsListSkeletonRow key={index} />
      ))}
    </ul>
  );
}

type FamilyFilter = 'all' | 'classic' | 'ai';

function isFamilyFilter(value: string | null): value is FamilyFilter {
  return value === 'all' || value === 'classic' || value === 'ai';
}

/** `null` (the param is absent) means "never touched" — default to every
 * algorithm. A present-but-empty value means "the person deselected every
 * algorithm", which must stay empty, never fall back to the default.
 * A repeated id collapses to its first occurrence — two rows for the same
 * algorithm would collide on that row's own DOM id, key and `aria-current`. */
function parseAlgorithmIds(raw: string | null): AlgorithmId[] {
  if (raw === null) {
    return [...DEFAULT_ALGORITHM_IDS];
  }
  const known = new Set<string>(DEFAULT_ALGORITHM_IDS);
  const seen = new Set<string>();
  const ids: AlgorithmId[] = [];
  for (const id of raw.split(',')) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id as AlgorithmId);
    }
  }
  return ids;
}

export interface SimilarityCompareViewProps {
  /** Always a real, non-blank pair — never mounted with a placeholder pair. */
  pair: readonly [string, string];
  /** The algorithm id whose trace is currently open in the detail panel, if
   * this render came from the `/similarity/:algorithmId/trace` deep link. */
  openAlgorithmId: string | null;
}

/**
 * The actual compare screen: family filter, algorithm selection and the
 * compare request/table. Only ever mounted with a real pair, so every hook
 * and query in here — including the compare query's key — is built from
 * real document ids, never a placeholder. Shared by `SimilarityPage` (the
 * plain compare path and its trace deep link) and, as the "never a dead
 * end" fallback, `SimilarityMatrixPage` once the selection drops below
 * three while still on `/similarity/matrix`.
 *
 * The family Segmented is a **view-only filter**: it narrows which algo
 * buttons are visible, but never removes an id from the actual selection —
 * an already-selected algorithm sent to the backend stays selected even
 * while its button is hidden under a different family filter. Only toggling
 * a button (visible or not) changes what gets compared. The compare query is
 * keyed by `(documentIdA, documentIdB, selectedAlgorithmIds)`, so every
 * change to the selection issues a fresh request instead of reusing a stale
 * result.
 *
 * `family` and `selectedAlgorithmIds` live in the URL's own search params
 * (`family`, `algorithms`), not local `useState`: this component unmounts and
 * remounts whenever the selection moves away from a pair and back (rendered
 * conditionally by its callers), which would silently reset plain local
 * state on every such round-trip. The URL survives that unmount, so a filter
 * or algorithm choice made before losing the pair is still there once it
 * comes back.
 */
export function SimilarityCompareView({ pair, openAlgorithmId }: SimilarityCompareViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAtLeastLg = useIsAtLeastLg();
  const [searchParams, setSearchParams] = useSearchParams();
  // `setSearchParams` itself does not compose: its own functional-updater
  // form still resolves against this render's `searchParams` closure, so
  // two calls dispatched before a render flushes between them (e.g. a
  // family radio and an algorithm toggle reacting to one shared event)
  // each build from the same stale base and the second's `navigate` call
  // simply replaces the URL the first one just set, losing it. This ref
  // instead tracks the *last params either updater actually committed*,
  // resynced from `searchParams` after every render (so a change from
  // outside these updaters — a browser back/forward, `openTrace`'s own
  // navigate — is still picked up) and updated by the updaters below the
  // instant they call `setSearchParams`, so a second update in the same
  // tick reads the first's own result, not the render's now-stale snapshot.
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  function commitSearchParams(update: (prev: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(searchParamsRef.current);
    update(nextParams);
    searchParamsRef.current = nextParams;
    setSearchParams(nextParams, { replace: true });
  }

  const rawFamily = searchParams.get('family');
  const family: FamilyFilter = isFamilyFilter(rawFamily) ? rawFamily : 'all';
  const selectedAlgorithmIds = useMemo(
    () => parseAlgorithmIds(searchParams.get('algorithms')),
    [searchParams],
  );

  const algorithmsQuery = useQuery<ListSimilarityAlgorithmsResponse, ApiError>({
    queryKey: ALGORITHMS_QUERY_KEY,
    queryFn: fetchSimilarityAlgorithms,
  });

  const catalogueById = useMemo(() => {
    const map = new Map<string, ListSimilarityAlgorithmsResponse[number]>();
    for (const algorithm of algorithmsQuery.data ?? []) {
      map.set(algorithm.id, algorithm);
    }
    return map;
  }, [algorithmsQuery.data]);

  const visibleAlgorithmOptions = useMemo(
    () =>
      (algorithmsQuery.data ?? [])
        .filter((algorithm) => family === 'all' || algoFamilyFromKind(algorithm.kind) === family)
        .map((algorithm) => ({ id: algorithm.id, family: algoFamilyFromKind(algorithm.kind) })),
    [algorithmsQuery.data, family],
  );

  function setFamily(next: FamilyFilter) {
    commitSearchParams((nextParams) => {
      if (next === 'all') {
        nextParams.delete('family');
      } else {
        nextParams.set('family', next);
      }
    });
  }

  function toggleAlgorithm(id: string) {
    const algorithmId = id as AlgorithmId;
    commitSearchParams((nextParams) => {
      const currentIds = parseAlgorithmIds(nextParams.get('algorithms'));
      const nextIds = currentIds.includes(algorithmId)
        ? currentIds.filter((existing) => existing !== algorithmId)
        : [...currentIds, algorithmId];
      nextParams.set('algorithms', nextIds.join(','));
    });
  }

  const hasAlgorithmsSelected = selectedAlgorithmIds.length > 0;

  // Sorted, never the raw toggle order — selecting d02 before d01 must
  // still compare (and label) the pair as d01/d02, the same order the rail's
  // own CTA uses (`sortedPair`).
  const [documentIdA, documentIdB] = pair;

  const compareQuery = useQuery<CompareResponse, ApiError>({
    queryKey: ['similarity', 'compare', documentIdA, documentIdB, selectedAlgorithmIds] as const,
    queryFn: () => {
      const body: CompareRequestBody = {
        documentIdA,
        documentIdB,
        algorithmIds: selectedAlgorithmIds,
      };
      return compareSimilarity(body);
    },
    enabled: hasAlgorithmsSelected,
  });

  const familyOptions: readonly SegmentedOption<FamilyFilter>[] = [
    { value: 'all', label: t('similarity.family.all') },
    { value: 'classic', label: t('similarity.family.classic') },
    { value: 'ai', label: t('similarity.family.ai') },
  ];

  // A row's trace trigger opens the panel by navigating to the deep-link
  // route with this exact pair, while keeping every other already-present
  // search param (the family filter, the algorithm selection) instead of
  // wiping them.
  function openTrace(algorithmId: string) {
    // `searchParamsRef.current`, not this render's own `searchParams`
    // snapshot — the same staleness `commitSearchParams` above already
    // guards against: a family/algorithm change and a row's own trace open
    // dispatched in the same tick (before React flushes a render between
    // them) must still both land in the URL, not have the second overwrite
    // the first with a now-stale base.
    const nextParams = new URLSearchParams(searchParamsRef.current);
    nextParams.set('documentIdA', documentIdA);
    nextParams.set('documentIdB', documentIdB);
    navigate({
      pathname: `/similarity/${encodeURIComponent(algorithmId)}/trace`,
      search: `?${nextParams.toString()}`,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PanelHeader
        eyebrow={t('similarity.title')}
        title={
          <>
            <span className="font-mono">{documentIdA}</span> {t('similarity.pairTitle.connector')}{' '}
            <span className="font-mono">{documentIdB}</span>
          </>
        }
      />

      <SegmentedControl
        options={familyOptions}
        value={family}
        onChange={setFamily}
        aria-label={t('similarity.family.groupLabel')}
      />

      {algorithmsQuery.isPending && (
        <>
          <p role="status" className="sr-only">
            {t('similarity.algorithmsLoading')}
          </p>
          <AlgorithmListSkeleton />
        </>
      )}
      {algorithmsQuery.isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">
            {t('similarity.algorithmsErrorTitle')}
          </p>
          <p className="text-body text-ink-secondary">
            {t(algorithmsQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}
      {algorithmsQuery.data && (
        <AlgoTextList
          options={visibleAlgorithmOptions}
          selectedIds={selectedAlgorithmIds}
          onToggle={toggleAlgorithm}
          aria-label={t('similarity.algorithmsGroupLabel')}
        />
      )}

      {!hasAlgorithmsSelected && (
        <p className="text-body text-ink-secondary">{t('similarity.selection.noAlgorithms')}</p>
      )}

      {compareQuery.isPending && hasAlgorithmsSelected && (
        <>
          <p role="status" className="sr-only">
            {t('similarity.compareLoading')}
          </p>
          {isAtLeastLg ? (
            <CompareTableSkeleton rowCount={selectedAlgorithmIds.length} />
          ) : (
            <CompareResultsListSkeleton rowCount={selectedAlgorithmIds.length} />
          )}
        </>
      )}
      {compareQuery.isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">{t('similarity.compareErrorTitle')}</p>
          <p className="text-body text-ink-secondary">
            {t(compareQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}
      {compareQuery.data &&
        (isAtLeastLg ? (
          <CompareTable
            rows={compareQuery.data}
            catalogueById={catalogueById}
            onOpenTrace={openTrace}
            openAlgorithmId={openAlgorithmId}
          />
        ) : (
          <CompareResultsList
            rows={compareQuery.data}
            catalogueById={catalogueById}
            onOpenTrace={openTrace}
            openAlgorithmId={openAlgorithmId}
          />
        ))}
    </div>
  );
}
