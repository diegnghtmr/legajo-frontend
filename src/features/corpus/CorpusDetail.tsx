import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import type { ApiError } from '../../infrastructure/apiError';
import {
  fetchCorpusDocument,
  type GetCorpusDocumentResponse,
} from '../../infrastructure/api/corpus';
import { Panel, PanelHeader } from '../../shared/components/Panel';

export const corpusDocumentQueryKey = (id: string) => ['corpus', 'document', id] as const;

/**
 * Full article detail (PRD HU-1.1, `GET /corpus/{id}`), rendered at the
 * `/corpus/:id` route. Reads its id from the route params rather than a
 * prop, since it only ever renders as a route element (see `CorpusPage`).
 */
export function CorpusDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const { data, isPending, isError, error } = useQuery<GetCorpusDocumentResponse, ApiError>({
    queryKey: corpusDocumentQueryKey(id ?? ''),
    queryFn: () => fetchCorpusDocument(id ?? ''),
    enabled: Boolean(id),
  });

  if (isPending) {
    return (
      <p role="status" className="text-body text-ink-secondary">
        {t('corpus.detail.loading')}
      </p>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col gap-1">
        <p className="text-body font-semibold text-danger">{t('corpus.detail.errorTitle')}</p>
        <p className="text-body text-ink-secondary">{t(error.i18nKey)}</p>
      </div>
    );
  }

  return (
    <Panel className="flex flex-col gap-4">
      <PanelHeader eyebrow={t('corpus.eyebrow')} title={data.title} />
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
            {t('corpus.detail.idLabel')}
          </dt>
          <dd className="font-mono text-mono text-ink-muted">{data.id}</dd>
        </div>
        <div>
          <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
            {t('corpus.detail.authorsLabel')}
          </dt>
          <dd className="text-body text-ink-secondary">{data.authors.join(', ')}</dd>
        </div>
        <div>
          <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
            {t('corpus.detail.abstractLabel')}
          </dt>
          <dd className="text-body text-ink">{data.abstract}</dd>
        </div>
      </dl>
    </Panel>
  );
}
