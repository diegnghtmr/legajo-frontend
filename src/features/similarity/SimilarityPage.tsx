import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  compareSimilarity,
  fetchSimilarityAlgorithms,
  type CompareRequestBody,
  type CompareResponse,
  type ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { AlgorithmIdSchema, type AlgorithmId } from '../../infrastructure/schemas/similarity';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { AlgoTextList } from '../../shared/components/AlgoTextList';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';
import { buttonVariants } from '../../shared/components/ui/button';
import { sortedPair, useSelectionStore } from '../corpus/selectionStore';
import { algoFamilyFromKind } from './algorithmFamily';
import { CompareTable } from './CompareTable';

export const ALGORITHMS_QUERY_KEY = ['similarity', 'algorithms'] as const;

/** The six fixed capability ids, independent of the catalogue fetch. */
const DEFAULT_ALGORITHM_IDS = [...AlgorithmIdSchema.options];

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

/**
 * Similarity compare screen. Reads the compared pair either from the trace
 * deep link's own `documentIdA`/`documentIdB` search params (when this route
 * matched `/similarity/:algorithmId/trace`) or, otherwise, from the shared
 * corpus `selectionStore` — exactly two selected, never auto-picked. Both
 * `/similarity` and `/similarity/:algorithmId/trace` render this same
 * component: a trace deep link never swaps the pairwise results out for a
 * trace-only screen, it only makes `SimilarityWorkbenchLayout` additionally
 * open that algorithm's trace in the detail panel next to these same
 * results (§6.3).
 *
 * `pair` is either `null` (empty state, nothing else rendered) or a real
 * `[a, b]` tuple, and only the latter is ever passed down to
 * `SimilarityCompareView`, which is the only place a compare query gets
 * created — there is no blank-id fallback to guard.
 *
 * The rail always wins once it names a real, different pair from the one a
 * trace deep link supplied: the link only drives the compared pair while
 * nothing else names one, or while the rail still agrees with it, never
 * after the person has since picked a different pair in the rail. That
 * switch also leaves the trace route entirely (back to plain `/similarity`,
 * with this same rail pair carried into the URL) instead of leaving a now
 *-mismatched trace open next to a different comparison.
 */
export function SimilarityPage() {
  const { t } = useTranslation();
  const { algorithmId: traceAlgorithmId } = useParams<{ algorithmId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedArticleIds = useSelectionStore((state) => state.selectedIds);
  const canMatrix = useSelectionStore((state) => state.canMatrix);

  const isTraceRoute = traceAlgorithmId !== undefined;
  const urlDocumentIdA = searchParams.get('documentIdA');
  const urlDocumentIdB = searchParams.get('documentIdB');
  // Normalized the same way the rail's own pair is (`sortedPair`), so a
  // reversed deep link (`documentIdA`/`documentIdB` swapped) still compares
  // — and labels — the pair in the same order regardless of which query
  // param named which id. The same document named twice is degenerate, not
  // a pair, so it is never even handed to `sortedPair` (which does not
  // itself reject that shape — both its inputs are already known-distinct
  // ids everywhere else it's called).
  const urlPair: readonly [string, string] | null =
    isTraceRoute && urlDocumentIdA && urlDocumentIdB && urlDocumentIdA !== urlDocumentIdB
      ? sortedPair([urlDocumentIdA, urlDocumentIdB])
      : null;
  const railPair = sortedPair(selectedArticleIds);
  const pair = railPair ?? urlPair;

  // The deep link's own pair is stale once the rail names a different, real
  // one — leave the trace route and drop its now-mismatched document ids,
  // carrying this same rail pair into the plain `/similarity` URL instead.
  const staleTracePair =
    isTraceRoute &&
    railPair !== null &&
    urlPair !== null &&
    (railPair[0] !== urlPair[0] || railPair[1] !== urlPair[1]);

  useEffect(() => {
    if (!staleTracePair) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('documentIdA');
    nextParams.delete('documentIdB');
    const search = nextParams.toString();
    navigate(`/similarity${search ? `?${search}` : ''}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running this for every render `staleTracePair` stays true is harmless (the navigate below leaves the trace route on its very next commit, which flips the condition false); listing `searchParams`/`navigate` here would only make it re-run for reasons that never change what it does.
  }, [staleTracePair]);

  if (pair === null) {
    return (
      <div className="flex flex-col gap-4">
        <PanelHeader eyebrow={t('similarity.eyebrow')} title={t('similarity.title')} />
        <Panel>
          <p role="status" className="text-body text-ink-secondary">
            {t('similarity.selection.emptyState')}
          </p>
          {canMatrix && (
            <div className="mt-3">
              <Link to="/similarity/matrix" className={buttonVariants({ variant: 'secondary' })}>
                {t('similarity.selection.viewMatrix')}
              </Link>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  return <SimilarityCompareView pair={pair} openAlgorithmId={traceAlgorithmId ?? null} />;
}

interface SimilarityCompareViewProps {
  /** Always a real, non-blank pair — `SimilarityPage` only mounts this
   * component once a pair has resolved (from the URL or the rail). */
  pair: readonly [string, string];
  /** The algorithm id whose trace is currently open in the detail panel, if
   * this render came from the `/similarity/:algorithmId/trace` deep link. */
  openAlgorithmId: string | null;
}

/**
 * The actual compare screen: family filter, algorithm selection and the
 * compare request/table. Only ever mounted with a real pair, so every hook
 * and query in here — including the compare query's key — is built from
 * real document ids, never a placeholder.
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
 * conditionally by `SimilarityPage`), which would silently reset plain local
 * state on every such round-trip. The URL survives that unmount, so a filter
 * or algorithm choice made before losing the pair is still there once it
 * comes back.
 */
function SimilarityCompareView({ pair, openAlgorithmId }: SimilarityCompareViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('documentIdA', documentIdA);
    nextParams.set('documentIdB', documentIdB);
    navigate({
      pathname: `/similarity/${encodeURIComponent(algorithmId)}/trace`,
      search: `?${nextParams.toString()}`,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PanelHeader eyebrow={t('similarity.eyebrow')} title={t('similarity.title')} />
      <p className="font-mono text-mono text-ink-muted">
        {t('similarity.selection.comparing', { a: documentIdA, b: documentIdB })}
      </p>

      <SegmentedControl
        options={familyOptions}
        value={family}
        onChange={setFamily}
        aria-label={t('similarity.family.groupLabel')}
      />

      {algorithmsQuery.isPending && (
        <p role="status" className="text-body text-ink-secondary">
          {t('similarity.algorithmsLoading')}
        </p>
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
        <p role="status" className="text-body text-ink-secondary">
          {t('similarity.compareLoading')}
        </p>
      )}
      {compareQuery.isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">{t('similarity.compareErrorTitle')}</p>
          <p className="text-body text-ink-secondary">
            {t(compareQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}
      {compareQuery.data && (
        <CompareTable
          rows={compareQuery.data}
          catalogueById={catalogueById}
          onOpenTrace={openTrace}
          openAlgorithmId={openAlgorithmId}
        />
      )}
    </div>
  );
}
