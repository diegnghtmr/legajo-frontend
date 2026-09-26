import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { fetchCorpus, type ListCorpusResponse } from '../../infrastructure/api/corpus';
import { fetchSimilarityMatrix, type MatrixResponse } from '../../infrastructure/api/similarity';
import { AlgorithmIdSchema, type AlgorithmId } from '../../infrastructure/schemas/similarity';
import {
  AlgoTextRadioGroup,
  type AlgoTextRadioOption,
} from '../../shared/components/AlgoTextRadioGroup';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { CORPUS_LIST_QUERY_KEY } from '../corpus/SelectionRail';
import { sortedPair, useSelectionStore } from '../corpus/selectionStore';
import { SimilarityCompareView } from './SimilarityCompareView';
import { MatrixTable } from './matrix/MatrixTable';

/**
 * The six fixed capability ids, the same fixed list the compare screen already
 * uses for its default selection (`AlgorithmIdSchema`) — no
 * dependency on the `/similarity/algorithms` catalogue fetch, so the matrix
 * request can fire immediately without waiting on a second, unrelated query.
 */
const ALGORITHM_IDS = [...AlgorithmIdSchema.options];

/** `levenshtein` (the first fixed id) is the default: a deterministic,
 * always-available classic capability, consistent with the compare screen's
 * "no catalogue dependency" default reasoning. */
const DEFAULT_ALGORITHM_ID: AlgorithmId = ALGORITHM_IDS[0];

const ALGORITHM_OPTIONS: readonly AlgoTextRadioOption[] = ALGORITHM_IDS.map((id) => ({ id }));

/**
 * The m×m similarity matrix content itself: reads the shared corpus
 * `selectionStore` and lets the user pick exactly one algorithm via the
 * locked mono text-button pattern wired as a `radiogroup`
 * (`AlgoTextRadioGroup`). Assumes at least three articles are selected —
 * every caller only renders this once `canMatrix` is true, so the matrix
 * request itself stays gated on that same flag as a defensive second check,
 * never a redundant prop the two could disagree on.
 *
 * Shared by `SimilarityMatrixPage` (the `/similarity/matrix` deep link) and
 * `SimilarityPage` (the plain compare path and its trace deep link, at `lg`
 * and above): the matrix is a mode of the same center region, not a
 * separate screen, so both routes render this exact component whenever the
 * selection calls for it.
 */
export function SimilarityMatrixView() {
  const { t } = useTranslation();
  const canMatrix = useSelectionStore((state) => state.canMatrix);
  const selectedArticleIds = useSelectionStore((state) => state.selectedIds);
  const [algorithmId, setAlgorithmId] = useState<AlgorithmId>(DEFAULT_ALGORITHM_ID);

  const corpusQuery = useQuery<ListCorpusResponse, ApiError>({
    queryKey: CORPUS_LIST_QUERY_KEY,
    queryFn: fetchCorpus,
  });

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const article of corpusQuery.data ?? []) {
      map.set(article.id, article.title);
    }
    return map;
  }, [corpusQuery.data]);

  const matrixQuery = useQuery<MatrixResponse, ApiError>({
    queryKey: ['similarity', 'matrix', selectedArticleIds, algorithmId] as const,
    queryFn: () => fetchSimilarityMatrix({ algorithmId, documentIds: [...selectedArticleIds] }),
    enabled: canMatrix,
  });

  return (
    <div className="flex flex-col gap-6">
      <PanelHeader eyebrow={t('similarity.matrix.eyebrow')} title={t('similarity.matrix.title')} />

      <AlgoTextRadioGroup
        options={ALGORITHM_OPTIONS}
        value={algorithmId}
        onChange={(id) => setAlgorithmId(id as AlgorithmId)}
        aria-label={t('similarity.matrix.algorithmGroupLabel')}
      />

      {matrixQuery.isPending && (
        <p role="status" className="text-body text-ink-secondary">
          {t('similarity.matrix.loading')}
        </p>
      )}
      {matrixQuery.isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">{t('similarity.matrix.errorTitle')}</p>
          <p className="text-body text-ink-secondary">
            {t(matrixQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}
      {matrixQuery.data && (
        <MatrixTable
          documentIds={selectedArticleIds}
          titleById={titleById}
          cells={matrixQuery.data}
        />
      )}
    </div>
  );
}

/**
 * The `/similarity/matrix` deep link's own route component. Kept sane
 * against a selection that has since dropped below three (never a dead
 * end): with fewer than three selected it falls back to the pairwise view
 * for an exact two, the same view `/similarity` itself shows, or the
 * guidance empty state below two — the same "center follows the selection"
 * rule the plain compare path applies, so a bookmarked or shared
 * `/similarity/matrix` link never strands the person on a screen with
 * nothing to show once they change the selection.
 */
export function SimilarityMatrixPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canMatrix = useSelectionStore((state) => state.canMatrix);
  const selectedArticleIds = useSelectionStore((state) => state.selectedIds);

  useEffect(() => {
    if (canMatrix) {
      return;
    }
    // Dropping below three while still on this exact deep link must never
    // leave a stale /similarity/matrix behind once the fallback below
    // already shows the pair or the guidance state — the URL now says
    // exactly what plain /similarity itself would.
    navigate('/similarity', { replace: true });
  }, [canMatrix, navigate]);

  if (canMatrix) {
    return <SimilarityMatrixView />;
  }

  const pair = sortedPair(selectedArticleIds);
  if (pair) {
    return <SimilarityCompareView pair={pair} openAlgorithmId={null} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader eyebrow={t('similarity.matrix.eyebrow')} title={t('similarity.matrix.title')} />
      <Panel>
        <p role="status" className="text-body text-ink-secondary">
          {t('similarity.selection.emptyState')}
        </p>
      </Panel>
    </div>
  );
}
