import type { Ref } from 'react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  fetchSimilarityAlgorithms,
  fetchSimilarityTrace,
  type ListSimilarityAlgorithmsResponse,
  type SimilarityTraceResponse,
} from '../../infrastructure/api/similarity';
import type { DpMatrixHandle } from '../../shared/components/DpMatrix';
import type { AlgoFamily } from '../../shared/family';
import { sortedPair, useSelectionStore } from '../corpus/selectionStore';
import { DpTracePanel } from './traces/DpTracePanel';
import { EmbeddingApiTracePanel } from './traces/EmbeddingApiTracePanel';
import { EmbeddingLocalTracePanel } from './traces/EmbeddingLocalTracePanel';
import { JaccardTracePanel } from './traces/JaccardTracePanel';
import { TfIdfTracePanel } from './traces/TfIdfTracePanel';
import { algoFamilyFromKind } from './algorithmFamily';
import { ALGORITHMS_QUERY_KEY } from './SimilarityPage';
import { clearTraceTrigger } from './traceFocusReturn';
import { PanelHeader } from '../../shared/components/Panel';
import { Button } from '../../shared/components/ui/button';
import { TraceBodySkeleton } from './traces/TraceBodySkeleton';

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
 * One capability's complete audit trace, rendered full-screen
 * (`/similarity/:algorithmId/trace/full`). Reads `algorithmId` from the
 * route and `documentIdA`/`documentIdB` from the query string set by
 * `CompareTable`'s link. A rejected fetch renders the mapped `ApiError`:
 * 404 `unknown-algorithm` for a bad path segment, 400 `unknown-document` for
 * a bad query id.
 *
 * `SimilarityWorkbenchLayout` still renders its own persistent rail
 * alongside this page (this route nests inside that same layout, exactly
 * like the docked trace route) — the rail always wins once it names a real,
 * different pair from the one this URL supplies, or names no pair at all
 * (a deselection, or Limpiar), the same rule `SimilarityPage` already
 * applies to the docked trace. Unlike the docked trace, though, there is no
 * "different pair, same full view" case here: ANY mismatch between the
 * rail and this URL's own pair leaves the full-screen route entirely, back
 * to plain `/similarity` (with this same rail pair carried into the URL),
 * where the plain compare screen's own auto-follow (the pair, the matrix,
 * or the guidance) takes over — never a stale full-screen trace left open
 * next to a rail that has since moved on.
 */
export function SimilarityTracePage() {
  const { t } = useTranslation();
  const { algorithmId } = useParams<{ algorithmId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const documentIdA = searchParams.get('documentIdA') ?? '';
  const documentIdB = searchParams.get('documentIdB') ?? '';

  const selectedArticleIds = useSelectionStore((state) => state.selectedIds);
  const railPair = sortedPair(selectedArticleIds);
  // The same-document-twice guard `SimilarityPage`'s own `urlPair` already
  // applies to the docked trace route — a URL naming one id twice is
  // degenerate, never a real pair to defend against the rail moving on.
  const urlPair: readonly [string, string] | null =
    documentIdA && documentIdB && documentIdA !== documentIdB
      ? sortedPair([documentIdA, documentIdB])
      : null;
  // Whether the rail has ever named a real selection during this mount —
  // monotonic, adjusted during render, the exact same pattern
  // `SimilarityPage` already uses for the docked trace route (see its own
  // doc comment for why this distinguishes a still-seeding cold deep link
  // from a genuine deselection/Limpiar).
  const [railHasBeenTouched, setRailHasBeenTouched] = useState(selectedArticleIds.length > 0);
  if (selectedArticleIds.length > 0 && !railHasBeenTouched) {
    setRailHasBeenTouched(true);
  }
  const staleTracePair =
    urlPair !== null &&
    railHasBeenTouched &&
    (railPair === null || railPair[0] !== urlPair[0] || railPair[1] !== urlPair[1]);

  useEffect(() => {
    if (!staleTracePair) {
      return;
    }
    // The rail — not the person's own close action — is what ends this full
    // view, so its remembered focus-return target is dropped without
    // focusing anything (`traceFocusReturn`'s own contract, mirrored from
    // `SimilarityPage`'s identical effect for the docked trace route).
    clearTraceTrigger();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('documentIdA');
    nextParams.delete('documentIdB');
    const search = nextParams.toString();
    navigate(`/similarity${search ? `?${search}` : ''}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running this for every render `staleTracePair` stays true is harmless (the navigate below leaves this route on its very next commit, which flips the condition false); listing `searchParams`/`navigate` here would only make it re-run for reasons that never change what it does.
  }, [staleTracePair]);

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
        <>
          <p role="status" className="sr-only">
            {t('similarity.trace.loading')}
          </p>
          <TraceBodySkeleton />
        </>
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
