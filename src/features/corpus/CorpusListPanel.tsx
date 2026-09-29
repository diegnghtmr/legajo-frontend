import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { fetchCorpus, type ListCorpusResponse } from '../../infrastructure/api/corpus';
import {
  fetchEmbeddingsStatus,
  type EmbeddingsStatusResponse,
} from '../../infrastructure/api/embeddings';
import { Checkbox } from '../../shared/components/ui/checkbox';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { cn } from '../../shared/lib/cn';
import { useSelectionStore } from './selectionStore';

/** Fills the rail's scroll region with a plausible page of rows, since the
 * real row count is unknown before the corpus resolves. */
const ARTICLE_LIST_SKELETON_ROW_COUNT = 8;

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

/** Mirrors `ArticleRow`'s box exactly: checkbox square, two title bars and
 * the mono id bar underneath, so the swap to real rows causes no shift. */
function ArticleRowSkeleton() {
  return (
    <li className="rounded-md p-3">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-1 size-4 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </li>
  );
}

function ArticleListSkeleton() {
  return (
    <ul data-testid="corpus-list-skeleton" className="flex flex-col gap-1 p-2">
      {Array.from({ length: ARTICLE_LIST_SKELETON_ROW_COUNT }, (_, index) => (
        <ArticleRowSkeleton key={index} />
      ))}
    </ul>
  );
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

  const statusText = embeddingsQuery.isError
    ? t('corpus.rail.embeddings.errorValue')
    : t(`corpus.rail.embeddings.${embeddingsSummaryState(embeddingsQuery.data)}`);

  const selectedCount = selectedIds.length;
  const filtered = (data ?? []).filter((article) => matchesQuery(article, query));

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
        {embeddingsQuery.isPending && (
          <p role="status" className="sr-only">
            {t('corpus.rail.embeddings.loading')}
          </p>
        )}
        <button
          type="button"
          onClick={onOpenEmbeddings}
          aria-label={t('corpus.rail.embeddings.rowLabel', {
            status: embeddingsQuery.isPending
              ? t('corpus.rail.embeddings.loadingValue')
              : statusText,
          })}
          className="group -mx-2 flex cursor-pointer items-center justify-between gap-2 rounded-btn px-2 py-1 text-left hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus pointer-coarse:min-h-11"
        >
          <span className="text-label font-semibold text-ink-secondary">
            {t('corpus.rail.embeddings.label')}
          </span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-mono text-ink">
              {embeddingsQuery.isPending ? (
                <Skeleton className="inline-block h-3 w-20 align-middle" />
              ) : (
                statusText
              )}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-muted motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
            />
          </span>
        </button>
      </div>

      <div
        // While loading the list holds only `aria-hidden` placeholder rows
        // and no focusable descendant, so it is clipped rather than scrolled:
        // a scroll box with nothing focusable in it would need a tab stop of
        // its own, and a skeleton holds none.
        className={cn('flex-1', isPending ? 'overflow-y-hidden' : 'overflow-y-auto')}
      >
        {isPending && (
          <>
            <p role="status" className="sr-only">
              {t('corpus.loading')}
            </p>
            <ArticleListSkeleton />
          </>
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
