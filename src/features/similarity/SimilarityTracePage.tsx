import type { Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  fetchSimilarityAlgorithms,
  fetchSimilarityTrace,
  type ListSimilarityAlgorithmsResponse,
  type SimilarityTraceResponse,
} from '../../infrastructure/api/similarity';
import type { DpMatrixHandle } from '../../shared/components/DpMatrix';
import type { AlgoFamily } from '../../shared/family';
import { DpTracePanel } from './traces/DpTracePanel';
import { EmbeddingApiTracePanel } from './traces/EmbeddingApiTracePanel';
import { EmbeddingLocalTracePanel } from './traces/EmbeddingLocalTracePanel';
import { JaccardTracePanel } from './traces/JaccardTracePanel';
import { TfIdfTracePanel } from './traces/TfIdfTracePanel';
import { algoFamilyFromKind } from './algorithmFamily';
import { ALGORITHMS_QUERY_KEY } from './SimilarityPage';
import { PanelHeader } from '../../shared/components/Panel';
import { Button } from '../../shared/components/ui/button';

/**
 * Routes one resolved trace to its panel by the `algorithmId` discriminator.
 * `levenshtein`/`needleman-wunsch` share `DpTracePanel` — the only variant
 * that needs the catalogue's `family`, for its required meta row; every
 * other capability has exactly one panel and no such dependency. Zod already
 * guarantees the discriminator is one of these five variants
 * (`AlgorithmTraceSchema`), so there is no "unknown" branch to render — a
 * rejected fetch is handled separately by the query's error state, never here.
 */
/** Exported for the trace detail panel (`TraceDetailPanel`), which routes a
 * resolved trace to the same per-capability body this standalone page uses,
 * so the two never drift into two different sets of panels for the same
 * six capabilities. */
export function TracePanel({
  trace,
  family,
  dpMatrixRef,
  hideDpMetaRow = false,
  hideDpDownloadButton = false,
}: {
  trace: SimilarityTraceResponse;
  family: AlgoFamily | undefined;
  /** Only meaningful for the two DP variants; ignored otherwise. Lets the
   * trace detail panel forward a ref and suppress this body's own meta
   * row/download button when it renders its own equivalents instead. */
  dpMatrixRef?: Ref<DpMatrixHandle>;
  hideDpMetaRow?: boolean;
  hideDpDownloadButton?: boolean;
}) {
  switch (trace.algorithmId) {
    case 'levenshtein':
    case 'needleman-wunsch':
      return (
        <DpTracePanel
          ref={dpMatrixRef}
          trace={trace}
          family={family}
          hideOwnMetaRow={hideDpMetaRow}
          hideDownloadButton={hideDpDownloadButton}
        />
      );
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
 * One capability's complete audit trace (`/similarity/:algorithmId/trace`).
 * Reads `algorithmId` from the
 * route and `documentIdA`/`documentIdB` from the query string set by
 * `CompareTable`'s link. A rejected fetch renders the mapped `ApiError`:
 * 404 `unknown-algorithm` for a bad path segment, 400 `unknown-document` for
 * a bad query id.
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

  // The same catalogue query `SimilarityPage` already runs (same key: a
  // cache hit when this page is reached through its own trace link) — the
  // header needs the algorithm's own name and family, never a repeat of the
  // eyebrow or a guess. A direct-navigated/bookmarked trace URL just pays
  // for its own fetch; the title falls back to the plain id until it
  // resolves rather than blocking the whole header on it.
  const algorithmsQuery = useQuery<ListSimilarityAlgorithmsResponse, ApiError>({
    queryKey: ALGORITHMS_QUERY_KEY,
    queryFn: fetchSimilarityAlgorithms,
  });
  const algorithmSummary = algorithmsQuery.data?.find((algorithm) => algorithm.id === algorithmId);
  const title = algorithmSummary?.displayName ?? algorithmId ?? '';
  const family = algorithmSummary ? algoFamilyFromKind(algorithmSummary.kind) : undefined;
  // Never a raw placeholder ("  frente a  ") when a document id is missing
  // from the URL: the subtitle is omitted entirely rather than
  // interpolating an empty operand.
  const hasBothDocumentIds = documentIdA !== '' && documentIdB !== '';

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        eyebrow={t('similarity.trace.eyebrow')}
        title={title}
        subtitle={
          hasBothDocumentIds
            ? t('similarity.trace.subtitle', { a: documentIdA, b: documentIdB })
            : undefined
        }
      />

      {algorithmsQuery.isError && (
        <div role="alert" className="flex flex-col items-start gap-1">
          <p className="text-body font-semibold text-danger">
            {t('similarity.trace.algorithmErrorTitle')}
          </p>
          <p className="text-body text-ink-secondary">
            {t(algorithmsQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
          <Button
            variant="secondary"
            className="mt-1"
            onClick={() => void algorithmsQuery.refetch()}
          >
            {t('similarity.trace.algorithmRetryLabel')}
          </Button>
        </div>
      )}

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

      {traceQuery.data && <TracePanel trace={traceQuery.data} family={family} />}

      <Link
        // Back to this exact trace in the docked workbench when both
        // document ids are present — never a bare `/similarity`, which
        // would land on whatever (or nothing) the rail happens to have
        // selected and lose the pair this same view is already showing.
        // Only a genuinely incomplete URL (a missing id) falls back to the
        // plain compare path, the same "no pair to preserve" case the
        // subtitle above already guards with `hasBothDocumentIds`.
        to={
          hasBothDocumentIds
            ? `/similarity/${encodeURIComponent(algorithmId ?? '')}/trace?documentIdA=${encodeURIComponent(documentIdA)}&documentIdB=${encodeURIComponent(documentIdB)}`
            : '/similarity'
        }
        className="w-fit text-body font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('similarity.trace.backToCompare')}
      </Link>
    </div>
  );
}
