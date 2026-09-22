import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  fetchSimilarityTrace,
  type SimilarityTraceResponse,
} from '../../infrastructure/api/similarity';
import { DpTracePanel } from './traces/DpTracePanel';
import { EmbeddingApiTracePanel } from './traces/EmbeddingApiTracePanel';
import { EmbeddingLocalTracePanel } from './traces/EmbeddingLocalTracePanel';
import { JaccardTracePanel } from './traces/JaccardTracePanel';
import { TfIdfTracePanel } from './traces/TfIdfTracePanel';
import { PanelHeader } from '../../shared/components/Panel';

/**
 * Routes one resolved trace to its panel by the `algorithmId` discriminator
 * (TRD §6.3). `levenshtein`/`needleman-wunsch` share `DpTracePanel`; every
 * other capability has exactly one panel. Zod already guarantees the
 * discriminator is one of these five variants (`AlgorithmTraceSchema`), so
 * there is no "unknown" branch to render — a rejected fetch is handled
 * separately by the query's error state, never here.
 */
function TracePanel({ trace }: { trace: SimilarityTraceResponse }) {
  switch (trace.algorithmId) {
    case 'levenshtein':
    case 'needleman-wunsch':
      return <DpTracePanel trace={trace} />;
    case 'jaccard':
      return <JaccardTracePanel trace={trace} />;
    case 'tfidf-cosine':
      return <TfIdfTracePanel trace={trace} />;
    case 'embedding-local':
      return <EmbeddingLocalTracePanel trace={trace} />;
    case 'embedding-api':
      return <EmbeddingApiTracePanel trace={trace} />;
  }
}

/**
 * One capability's complete audit trace (`/similarity/:algorithmId/trace`,
 * DESIGN.md §6 item 2–3, PRD HU-1.2/1.3/1.6). Reads `algorithmId` from the
 * route and `documentIdA`/`documentIdB` from the query string set by
 * `CompareTable`'s link. A rejected fetch renders the mapped `ApiError`:
 * 404 `unknown-algorithm` for a bad path segment, 400 `unknown-document` for
 * a bad query id (TRD §6.6).
 */
export function SimilarityTracePage() {
  const { t } = useTranslation();
  const { algorithmId } = useParams<{ algorithmId: string }>();
  const [searchParams] = useSearchParams();
  const documentIdA = searchParams.get('documentIdA') ?? '';
  const documentIdB = searchParams.get('documentIdB') ?? '';

  const traceQuery = useQuery<SimilarityTraceResponse, ApiError>({
    queryKey: ['similarity', 'trace', algorithmId, documentIdA, documentIdB] as const,
    queryFn: () =>
      // The generated `algorithmId` path type is the closed `AlgorithmId` enum;
      // an unknown id is exactly what this route legitimately tests against
      // the backend's 404 `unknown-algorithm` mapping, so it is cast, not
      // narrowed, at this one boundary.
      fetchSimilarityTrace({
        algorithmId: (algorithmId ?? '') as SimilarityTraceResponse['algorithmId'],
        documentIdA,
        documentIdB,
      }),
    enabled: Boolean(algorithmId),
  });

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        eyebrow={t('similarity.trace.eyebrow')}
        title={t('similarity.trace.title', { id: algorithmId ?? '' })}
      />

      {traceQuery.isPending && (
        <p role="status" className="text-body text-ink-secondary">
          {t('similarity.trace.loading')}
        </p>
      )}

      {traceQuery.isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">{t('similarity.trace.errorTitle')}</p>
          <p className="text-body text-ink-secondary">
            {t(traceQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}

      {traceQuery.data && <TracePanel trace={traceQuery.data} />}

      <Link
        to="/similarity"
        className="w-fit text-body font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('similarity.trace.backToCompare')}
      </Link>
    </div>
  );
}
