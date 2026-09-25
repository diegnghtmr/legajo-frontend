import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { fetchCorpus, type ListCorpusResponse } from '../../infrastructure/api/corpus';
import { fetchSimilarityMatrix, type MatrixResponse } from '../../infrastructure/api/similarity';
import { AlgorithmIdSchema, type AlgorithmId } from '../../infrastructure/schemas/similarity';
import {
  AlgoTextRadioGroup,
  type AlgoTextRadioOption,
} from '../../shared/components/AlgoTextRadioGroup';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { buttonVariants } from '../../shared/components/ui/button';
import { CORPUS_LIST_QUERY_KEY } from '../corpus/ArticleList';
import { useSelectionStore } from '../corpus/selectionStore';
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
 * The m×m similarity matrix screen: reads the shared corpus
 * `selectionStore`, requires at least three selected articles (`canMatrix`),
 * and lets the user pick exactly one algorithm via the locked mono
 * text-button pattern wired as a `radiogroup` (`AlgoTextRadioGroup`).
 */
export function SimilarityMatrixPage() {
  const { t } = useTranslation();
  const selectedArticleIds = useSelectionStore((state) => state.selectedIds);
  const canMatrix = useSelectionStore((state) => state.canMatrix);
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

  if (!canMatrix) {
    return (
      <div className="flex flex-col gap-4">
        <PanelHeader
          eyebrow={t('similarity.matrix.eyebrow')}
          title={t('similarity.matrix.title')}
        />
        <Panel>
          <p role="status" className="text-body text-ink-secondary">
            {t('similarity.matrix.wrongCount', { count: selectedArticleIds.length })}
          </p>
          <div className="mt-3">
            <Link to="/corpus" className={buttonVariants({ variant: 'primary' })}>
              {t('similarity.selection.backToCorpus')}
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

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
