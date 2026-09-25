import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

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

/**
 * Similarity compare screen. Reads the two
 * selected articles from the shared corpus `selectionStore`; exactly two are
 * required and never auto-picked.
 *
 * `sortedPair` returns a pair only for exactly two selected ids — anything
 * else renders the empty state right here, before any compare-specific hook
 * or query exists. There is no blank-id fallback to guard: `pair` is either
 * `null` (empty state, nothing else rendered) or a real `[a, b]` tuple, and
 * only the latter is ever passed down to `SimilarityCompareView`, which is
 * the only place a compare query gets created.
 */
export function SimilarityPage() {
  const { t } = useTranslation();
  const selectedArticleIds = useSelectionStore((state) => state.selectedIds);
  const canMatrix = useSelectionStore((state) => state.canMatrix);
  const pair = sortedPair(selectedArticleIds);

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

  return <SimilarityCompareView pair={pair} />;
}

interface SimilarityCompareViewProps {
  /** Always a real, non-blank pair — `SimilarityPage` only mounts this
   * component once `sortedPair` has resolved one. */
  pair: readonly [string, string];
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
 */
function SimilarityCompareView({ pair }: SimilarityCompareViewProps) {
  const { t } = useTranslation();
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [selectedAlgorithmIds, setSelectedAlgorithmIds] =
    useState<AlgorithmId[]>(DEFAULT_ALGORITHM_IDS);

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

  const toggleAlgorithm = (id: string) => {
    const algorithmId = id as AlgorithmId;
    setSelectedAlgorithmIds((previous) =>
      previous.includes(algorithmId)
        ? previous.filter((existing) => existing !== algorithmId)
        : [...previous, algorithmId],
    );
  };

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
          documentIdA={documentIdA}
          documentIdB={documentIdB}
        />
      )}
    </div>
  );
}
