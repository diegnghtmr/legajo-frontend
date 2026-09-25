import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { fetchCorpus, type ListCorpusResponse } from '../../infrastructure/api/corpus';
import {
  fetchEmbeddingsStatus,
  type EmbeddingsStatusResponse,
} from '../../infrastructure/api/embeddings';
import { Checkbox } from '../../shared/components/ui/checkbox';
import { cn } from '../../shared/lib/cn';
import { useSelectionStore } from './selectionStore';

export const CORPUS_LIST_QUERY_KEY = ['corpus', 'list'] as const;
export const EMBEDDINGS_STATUS_QUERY_KEY = ['embeddings', 'status'] as const;

type ArticleSummary = ListCorpusResponse[number];

function matchesQuery(article: ArticleSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return (
    article.title.toLowerCase().includes(needle) ||
    article.id.toLowerCase().includes(needle) ||
    article.authors.some((author) => author.toLowerCase().includes(needle))
  );
}

/** Both embedding families match the corpus, reduced to a single quiet
 * status line — the full per-field breakdown only shows once the row is
 * opened in the detail panel. Absent data (the defensive branch below; the
 * caller only reaches this once the query has actually resolved
 * successfully) never claims a match it has not actually observed — an
 * honest "unknown" state instead of a dishonest default. */
export function embeddingsSummaryState(
  data: EmbeddingsStatusResponse | undefined,
): 'allMatch' | 'mismatch' | 'unknown' {
  if (!data) {
    return 'unknown';
  }
  return data.embeddingLocal.matchesCorpus && data.embeddingApi.matchesCorpus
    ? 'allMatch'
    : 'mismatch';
}

interface ArticleRowProps {
  article: ArticleSummary;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpenAbstract: (id: string) => void;
}

function ArticleRow({ article, selected, onToggle, onOpenAbstract }: ArticleRowProps) {
  const titleId = useId();

  return (
    <li className={cn('rounded-md p-3', selected && 'ring-[1.5px] ring-inset ring-ink')}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(article.id)}
          aria-labelledby={titleId}
          className="mt-1"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            id={titleId}
            onClick={() => onOpenAbstract(article.id)}
            className="line-clamp-2 text-left text-body font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {article.title}
          </button>
          <p className="font-mono text-mono text-ink-muted">{article.id}</p>
        </div>
      </div>
    </li>
  );
}

export interface CorpusListPanelProps {
  onOpenAbstract: (id: string) => void;
  onOpenEmbeddings: () => void;
  /** Sizing for this panel's own root, left to the host rather than a fixed
   * `h-full` here: `SelectionRail` and the corpus-list sheet both need
   * `flex-1 min-h-0` (a bounded flex sibling next to their own footer or
   * sheet chrome, so only this panel's internal row list scrolls); the
   * narrow-width "main content before any comparison" host needs no height
   * constraint at all, so its own list grows with the page instead — the
   * same natural document-flow scroll every other narrow-width screen
   * already uses. */
  className?: string;
}

/**
 * The corpus list itself, with no footer CTA: header (eyebrow, document
 * count, "Limpiar"/Clear), search, the one-line embeddings status, and the
 * scrollable row list (the checkbox selects, the title opens the abstract).
 * Shared, verbatim, between every host that needs it: the persistent `lg`+
 * `SelectionRail` sidebar (which adds its own pinned footer CTA around
 * this), and, below `lg`, both the `SelectionTray`'s corpus-list bottom
 * sheet and the similarity screen's own main content before any pair is
 * selected — reused as-is rather than duplicated, so a change to a row's
 * markup, the search behavior or the embeddings summary can never drift
 * between the desktop rail and either narrow-width host.
 */
export function CorpusListPanel({
  onOpenAbstract,
  onOpenEmbeddings,
  className,
}: CorpusListPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const toggle = useSelectionStore((state) => state.toggle);
  const clear = useSelectionStore((state) => state.clear);

  const { data, isPending, isError, error } = useQuery<ListCorpusResponse, ApiError>({
    queryKey: CORPUS_LIST_QUERY_KEY,
    queryFn: fetchCorpus,
  });

  const embeddingsQuery = useQuery<EmbeddingsStatusResponse, ApiError>({
    queryKey: EMBEDDINGS_STATUS_QUERY_KEY,
    queryFn: fetchEmbeddingsStatus,
  });

  const selectedCount = selectedIds.length;
  const filtered = (data ?? []).filter((article) => matchesQuery(article, query));

  const embeddingsValue = embeddingsQuery.isPending
    ? t('corpus.rail.embeddings.loading')
    : embeddingsQuery.isError
      ? t('corpus.rail.embeddings.errorValue')
      : t(`corpus.rail.embeddings.${embeddingsSummaryState(embeddingsQuery.data)}`);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex flex-col gap-3 border-b border-hairline p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
              {t('corpus.eyebrow')}
            </p>
            <p className="font-mono text-mono text-ink-muted">
              {t('corpus.rail.countLabel', { count: data?.length ?? 0 })}
            </p>
          </div>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={clear}
            className="rounded-btn px-2 py-1 text-label font-semibold text-ink-secondary hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-45 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            {t('corpus.rail.clear')}
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="sr-only">{t('corpus.rail.searchLabel')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('corpus.rail.searchPlaceholder')}
            className="h-9 rounded-btn border border-hairline-strong bg-paper-raised px-3 text-body text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </label>
      </div>

      <div className="border-b border-hairline p-4">
        <button
          type="button"
          onClick={onOpenEmbeddings}
          aria-label={t('corpus.rail.embeddings.openLabel')}
          className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus pointer-coarse:min-h-11"
        >
          <span className="text-label font-semibold text-ink-secondary">
            {t('corpus.rail.embeddings.label')}
          </span>
          <span className="font-mono text-mono text-ink">{embeddingsValue}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isPending && (
          <p role="status" className="p-4 text-body text-ink-secondary">
            {t('corpus.loading')}
          </p>
        )}
        {isError && (
          <div role="alert" className="flex flex-col gap-1 p-4">
            <p className="text-body font-semibold text-danger">{t('corpus.errorTitle')}</p>
            <p className="text-body text-ink-secondary">
              {t(error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
            </p>
          </div>
        )}
        {data && data.length === 0 && (
          <p className="p-4 text-body text-ink-secondary">{t('corpus.empty')}</p>
        )}
        {data && data.length > 0 && filtered.length === 0 && (
          <p className="p-4 text-body text-ink-muted">{t('corpus.rail.searchNoMatches')}</p>
        )}
        {filtered.length > 0 && (
          <ul className="flex flex-col gap-1 p-2">
            {filtered.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                selected={selectedIds.includes(article.id)}
                onToggle={toggle}
                onOpenAbstract={onOpenAbstract}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
