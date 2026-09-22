import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { fetchCorpus, type ListCorpusResponse } from '../../infrastructure/api/corpus';
import { ArticleRow } from './ArticleRow';
import { useSelectionStore } from './selectionStore';

export const CORPUS_LIST_QUERY_KEY = ['corpus', 'list'] as const;

/**
 * The corpus article list (PRD HU-1.1): TanStack Query owns the server data,
 * the shared `useSelectionStore` (Zustand) owns which ids are checked. No
 * loose HTTP call here — `fetchCorpus` lives in `infrastructure/`.
 */
export function ArticleList() {
  const { t } = useTranslation();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const toggle = useSelectionStore((state) => state.toggle);

  const { data, isPending, isError, error } = useQuery<ListCorpusResponse, ApiError>({
    queryKey: CORPUS_LIST_QUERY_KEY,
    queryFn: fetchCorpus,
  });

  if (isPending) {
    return (
      <p role="status" className="text-body text-ink-secondary">
        {t('corpus.loading')}
      </p>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col gap-1">
        <p className="text-body font-semibold text-danger">{t('corpus.errorTitle')}</p>
        <p className="text-body text-ink-secondary">
          {t(error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="text-body text-ink-secondary">{t('corpus.empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.map((article) => (
        <ArticleRow
          key={article.id}
          id={article.id}
          title={article.title}
          authors={article.authors}
          selected={selectedIds.includes(article.id)}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}
