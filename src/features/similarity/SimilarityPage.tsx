import { useMemo } from 'react';
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
 * algorithm", which must stay empty, never fall back to the default. */
function parseAlgorithmIds(raw: string | null): AlgorithmId[] {
  if (raw === null) {
    return [...DEFAULT_ALGORITHM_IDS];
  }
  const known = new Set<string>(DEFAULT_ALGORITHM_IDS);
  return raw
    .split(',')
    .filter((id) => known.has(id))
    .map((id) => id as AlgorithmId);
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
 */
export function SimilarityPage() {
  const { t } = useTranslation();
  const { algorithmId: traceAlgorithmId } = useParams<{ algorithmId?: string }>();
  const [searchParams] = useSearchParams();
  const selectedArticleIds = useSelectionStore((state) => state.selectedIds);
  const canMatrix = useSelectionStore((state) => state.canMatrix);

  const urlDocumentIdA = searchParams.get('documentIdA');
  const urlDocumentIdB = searchParams.get('documentIdB');
  const urlPair: readonly [string, string] | null =
    traceAlgorithmId !== undefined && urlDocumentIdA && urlDocumentIdB
      ? [urlDocumentIdA, urlDocumentIdB]
      : null;
  const pair = urlPair ?? sortedPair(selectedArticleIds);

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
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'all') {
      nextParams.delete('family');
    } else {
      nextParams.set('family', next);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function toggleAlgorithm(id: string) {
    const algorithmId = id as AlgorithmId;
    const nextIds = selectedAlgorithmIds.includes(algorithmId)
      ? selectedAlgorithmIds.filter((existing) => existing !== algorithmId)
      : [...selectedAlgorithmIds, algorithmId];
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('algorithms', nextIds.join(','));
    setSearchParams(nextParams, { replace: true });
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
