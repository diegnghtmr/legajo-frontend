import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY } from '../../infrastructure/apiError';
import type { ListSimilarityAlgorithmsResponse } from '../../infrastructure/api/similarity';
import { algorithmsQueryOptions } from '../../infrastructure/api/similarityCatalogue';
import type { AlgorithmId } from '../../infrastructure/schemas/similarity';
import { QueryErrorAlert } from '../../shared/components/QueryErrorAlert';
import { Alert } from '../../shared/components/Alert';
import { EmptyState } from '../../shared/components/EmptyState';
import { PanelHeader } from '../../shared/components/Panel';
import { AlgoTextList } from '../../shared/components/AlgoTextList';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';
import { useIsAtLeastLg } from '../../shared/lib/useIsAtLeastLg';
import { algoFamilyFromKind } from './algorithmFamily';
import { DEFAULT_ALGORITHM_IDS, parseAlgorithmIds } from './algorithmSelection';
import { compareQueryOptions } from './compareQueryOptions';
import { filterRowsByFamily, parseFamilyFilter, type FamilyFilter } from './familyFilter';
import { rememberTraceTrigger } from './traceFocusReturn';
import { CompareResultsList } from './CompareResultsList';
import {
  AlgorithmListSkeleton,
  CompareResultsListSkeleton,
  CompareTableSkeleton,
} from './CompareSkeleton';
import { CompareTable } from './CompareTable';
import { ScoreStrip, ScoreStripSkeleton } from './ScoreStrip';

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
 * The family Segmented is a **view-only filter**: it narrows the algo
 * buttons, the score strip, the results table (the list below `lg`) and the
 * open trace's ranking to the selected algorithms of that family, but never
 * removes an id from the actual selection — an already-selected algorithm
 * stays selected and is still compared while it is hidden, and reappears with
 * its result under `all` or its own family. Switching the filter therefore
 * issues no request. When no selected algorithm belongs to the chosen family
 * the results region shows an empty state saying so. If the open trace's
 * algorithm is hidden by a filter change, the trace closes and focus moves to
 * the results heading. Only toggling a button (visible or not) changes what
 * gets compared. The compare query is keyed by `(documentIdA, documentIdB,
 * selectedAlgorithmIds)`, so every change to the selection issues a fresh
 * request instead of reusing a stale result.
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

  const family = parseFamilyFilter(searchParams.get('family'));
  const selectedAlgorithmIds = useMemo(
    () => parseAlgorithmIds(searchParams.get('algorithms')),
    [searchParams],
  );

  const algorithmsQuery = useQuery(algorithmsQueryOptions);

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

  const compareQuery = useQuery({
    ...compareQueryOptions(documentIdA, documentIdB, selectedAlgorithmIds),
    enabled: hasAlgorithmsSelected,
  });

  const visibleRows = useMemo(
    () => (compareQuery.data ? filterRowsByFamily(compareQuery.data, family, catalogueById) : []),
    [compareQuery.data, family, catalogueById],
  );

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

  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingOnTraceClose = useRef(false);
  useEffect(() => {
    if (openAlgorithmId === null && focusHeadingOnTraceClose.current) {
      focusHeadingOnTraceClose.current = false;
      headingRef.current?.focus();
    }
  }, [openAlgorithmId]);

  function setFamily(next: FamilyFilter) {
    const openIsHidden =
      openAlgorithmId !== null &&
      next !== 'all' &&
      algoFamilyFromKind(catalogueById.get(openAlgorithmId)?.kind ?? 'CLASSIC') !== next;
    if (!openIsHidden || openAlgorithmId === null) {
      commitSearchParams((nextParams) => {
        if (next === 'all') {
          nextParams.delete('family');
        } else {
          nextParams.set('family', next);
        }
      });
      return;
    }
    // The open trace belongs to a row the new filter hides: close it the way
    // its own close button does (back to the plain compare URL, without the
    // pair), and land focus on the results heading rather than a vanished row.
    const nextParams = new URLSearchParams(searchParamsRef.current);
    nextParams.set('family', next);
    nextParams.delete('documentIdA');
    nextParams.delete('documentIdB');
    searchParamsRef.current = nextParams;
    // The workbench restores focus to the remembered trace trigger once the
    // panel closes; the vanished row can no longer take it, so the results
    // heading stands in for it.
    rememberTraceTrigger(headingRef.current, openAlgorithmId);
    focusHeadingOnTraceClose.current = true;
    navigate({ pathname: '/similarity', search: `?${nextParams.toString()}` }, { replace: true });
  }

  const familyLabel = family === 'ai' ? t('similarity.family.ai') : t('similarity.family.classic');
  const familyHidesEverything =
    family !== 'all' && compareQuery.data !== undefined && visibleRows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PanelHeader
        titleRef={headingRef}
        titleFocusable
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
          <AlgorithmListSkeleton algorithmIds={DEFAULT_ALGORITHM_IDS} />
        </>
      )}
      {algorithmsQuery.isError && (
        <Alert
          tone="danger"
          title={t('similarity.algorithmsErrorTitle')}
          body={t(algorithmsQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
        />
      )}
      {algorithmsQuery.data && (
        <AlgoTextList
          options={visibleAlgorithmOptions}
          selectedIds={selectedAlgorithmIds}
          onToggle={toggleAlgorithm}
          aria-label={t('similarity.algorithmsGroupLabel')}
        />
      )}

      {!hasAlgorithmsSelected && <EmptyState title={t('similarity.selection.noAlgorithms')} />}

      {(compareQuery.isPending || (family !== 'all' && algorithmsQuery.isPending)) &&
        hasAlgorithmsSelected && (
          <>
            <p role="status" className="sr-only">
              {t('similarity.compareLoading')}
            </p>
            <ScoreStripSkeleton count={selectedAlgorithmIds.length} />
            {isAtLeastLg ? (
              <CompareTableSkeleton
                algorithmIds={selectedAlgorithmIds}
                catalogueById={catalogueById}
              />
            ) : (
              <CompareResultsListSkeleton algorithmIds={selectedAlgorithmIds} />
            )}
          </>
        )}
      {compareQuery.isError && (
        <QueryErrorAlert
          title={t('similarity.compareErrorTitle')}
          error={compareQuery.error}
          endpoint="POST /api/v1/similarity/compare"
          onRetry={() => void compareQuery.refetch()}
        />
      )}
      {familyHidesEverything && (
        <EmptyState
          role="status"
          title={t('similarity.family.noneSelected', { family: familyLabel })}
          reason={t('similarity.family.noneSelectedReason')}
        />
      )}
      {compareQuery.data && !familyHidesEverything && (
        <ScoreStrip
          rows={visibleRows}
          catalogueById={catalogueById}
          onOpenTrace={openTrace}
          openAlgorithmId={openAlgorithmId}
          interactive={isAtLeastLg}
        />
      )}
      {compareQuery.data &&
        !familyHidesEverything &&
        (isAtLeastLg ? (
          <CompareTable
            rows={visibleRows}
            catalogueById={catalogueById}
            onOpenTrace={openTrace}
            openAlgorithmId={openAlgorithmId}
          />
        ) : (
          <CompareResultsList
            rows={visibleRows}
            catalogueById={catalogueById}
            onOpenTrace={openTrace}
            openAlgorithmId={openAlgorithmId}
          />
        ))}
    </div>
  );
}
