import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  fetchCorpusDocument,
  type GetCorpusDocumentResponse,
} from '../../infrastructure/api/corpus';
import { Button } from '../../shared/components/ui/button';
import { Skeleton } from '../../shared/components/ui/skeleton';

export const corpusDocumentQueryKey = (id: string) => ['corpus', 'document', id] as const;

export interface ArticleAbstractProps {
  id: string;
  onClose: () => void;
}

/**
 * A rail row's title opens this in the workbench's detail region: the
 * article's full abstract (`GET /corpus/{id}`), with the mono id and the
 * authors stacked as its subtitle line, since neither field fits the rail's
 * own compact row anymore.
 */
export function ArticleAbstract({ id, onClose }: ArticleAbstractProps) {
  const { t } = useTranslation();

  const { data, isPending, isError, error } = useQuery<GetCorpusDocumentResponse, ApiError>({
    queryKey: corpusDocumentQueryKey(id),
    queryFn: () => fetchCorpusDocument(id),
  });

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
            {t('corpus.eyebrow')}
          </p>
          <h2 className="text-title font-semibold text-ink">{data?.title ?? id}</h2>
          {data ? (
            <>
              <p className="font-mono text-mono text-ink-muted">{data.id}</p>
              <p className="text-body text-ink-muted">{data.authors.join(', ')}</p>
            </>
          ) : (
            isPending && (
              <>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3.5 w-40" />
              </>
            )
          )}
        </div>
        <Button variant="secondary" aria-label={t('corpus.detail.closeLabel')} onClick={onClose}>
          {t('corpus.detail.closeLabel')}
        </Button>
      </header>

      {isPending && (
        <>
          <p role="status" className="sr-only">
            {t('corpus.detail.loading')}
          </p>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </>
      )}
      {isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">{t('corpus.detail.errorTitle')}</p>
          <p className="text-body text-ink-secondary">
            {t(error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}
      {data && <p className="text-body text-ink">{data.abstract}</p>}
    </div>
  );
}
