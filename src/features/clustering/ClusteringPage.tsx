import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  cutClustering,
  runClustering,
  type ClusteringCutRequestBody,
  type ClusteringCutResponse,
  type ClusteringRequestBody,
  type ClusteringResponse,
} from '../../infrastructure/api/clustering';
import { fetchCorpus, type ListCorpusResponse } from '../../infrastructure/api/corpus';
import type { LinkageId, RepresentationId } from '../../infrastructure/schemas/clustering';
import { Alert } from '../../shared/components/Alert';
import { PanelHeader } from '../../shared/components/Panel';
import { CORPUS_LIST_QUERY_KEY } from '../corpus/SelectionRail';
import { ClusteringMetricsTable, ClusteringMetricsTableSkeleton } from './ClusteringMetricsTable';
import { resolveCutLabelsForLinkage } from './cutLabels';
import { tryComputeCutDistance } from './cutLine';
import {
  ClusteringParametersPanel,
  LINKAGE_IDS,
  type CutColumnState,
} from './ClusteringParametersPanel';
import { isValidCutK } from './cutSchema';
import { DendrogramCard, DendrogramCardSkeleton } from './DendrogramCard';
import { dendrogramCardHeight } from './dendrogramGridSizing';
import { leafLabelsFromDocumentIds } from './leafLabels';
import { ParametersSummaryBar } from './ParametersSummaryBar';
import { usePanelOutOfView } from './usePanelOutOfView';
import {
  hasCanonicalLinkageIds,
  kRefForSampleSize,
  metricsAtKRef,
  rankClusteringLinkages,
  sampleSizeFromResponse,
} from './ranking';

const DEFAULT_REPRESENTATION: RepresentationId = 'tfidf-cosine';

/** The cut's `k` before the user edits it: the smallest valid cut. */
const DEFAULT_CUT_K = 2;

const CLUSTERING_QUERY_KEY_PREFIX = 'clustering';

/** The dendrogram skeleton's own height needs a leaf count before either
 * the clustering or the corpus query has resolved — the reference corpus
 * size, a reasonable size for a loading placeholder that never claims to
 * know the real one. */
const DEFAULT_SKELETON_LEAF_COUNT = 20;

/**
 * Clustering screen: the parameter panel at the top (three numbered columns:
 * representation, linkage selection, and the free cut — linkage to cut, k,
 * `Aplicar corte` — over a status footer; a summary bar pins under the top
 * bar once it scrolls out of view), the metrics comparison table applying the fixed ranking
 * rule over the backend's own numbers (`ranking.ts`, `ClusteringMetricsTable`),
 * and a 2×2 dendrogram grid below (`DendrogramCard`, one card per linkage,
 * filling its own width).
 *
 * The sample size `n` (the sample-size caveat and `k_ref`) is derived from
 * the clustering response itself (every linkage's `leafOrder` length)
 * rather than from the separately cached corpus-list query, so a stale
 * corpus size can never silently mark leaders at the wrong cut. Ranking also
 * requires the linkages to agree on `n` and to be exactly the canonical set
 * `{single, complete, average, ward}`; either violation degrades to no
 * leader marks rather than guessing, the same "don't guess" reasoning the
 * matrix headers use.
 *
 * The four dendrograms render one per linkage, each from its own
 * `rows`/`leafOrder` — D3 only draws, it never computes a merge. A
 * successful free cut's cluster labels and dashed cut line are shown only
 * on the cut linkage's own dendrogram, never on the other three.
 */
export function ClusteringPage() {
  const { t } = useTranslation();
  const [representation, setRepresentation] = useState<RepresentationId>(DEFAULT_REPRESENTATION);
  const [selectedLinkages, setSelectedLinkages] = useState<LinkageId[]>([...LINKAGE_IDS]);
  const hasLinkagesSelected = selectedLinkages.length > 0;
  /**
   * A cut's labels only mean something for the exact request they were
   * computed against. Rather than resetting this in an effect (which would
   * call `setState` synchronously inside an effect body — a cascading-render
   * anti-pattern the project's lint rules reject), the request's own
   * `representation`/`linkages` are captured alongside the result and
   * compared, at render time, against the page's current selection; a stale
   * cut for a since-changed request is simply not applied to any panel.
   *
   * Only the request's own `k` is kept here, never a pre-computed distance:
   * the cut line's pixel position depends on whichever `rows` are currently
   * loaded for `linkageId`, so it is derived at render time (see
   * `tryComputeCutDistance` below) instead of inside the mutation, where a
   * throw would turn a successful cut into a rendering error.
   */
  const [cutResult, setCutResult] = useState<
    | {
        representation: RepresentationId;
        linkages: readonly LinkageId[];
        linkageId: LinkageId;
        k: number;
        labels: readonly number[];
        /** This cut's own `documentIds` — `labels[i]` is the
         * cluster of `documentIds[i]`. Joined with a linkage's own
         * `documentIds` by id, never by array position (`cutLabels.ts`). */
        documentIds: readonly string[];
      }
    | undefined
  >(undefined);
  /**
   * Scopes the cut error the same way `cutResult` is scoped: an error from a
   * since-changed (representation, linkages) request must not linger on the
   * form after the user moves on. `cutMutation.error` alone survives across
   * renders until the next `mutate()` call, so it is only shown when this
   * context still matches the page's current selection.
   */
  const [cutErrorContext, setCutErrorContext] = useState<
    { representation: RepresentationId; linkages: readonly LinkageId[] } | undefined
  >(undefined);

  /** The free-cut controls' own draft. The chosen linkage is only honored while
   * the loaded response still carries it (see `cutLinkage` below), so a
   * deselected linkage never lingers as the cut target. */
  const [cutLinkageChoice, setCutLinkageChoice] = useState<LinkageId | undefined>(undefined);
  const [cutK, setCutK] = useState<number>(DEFAULT_CUT_K);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelOutOfView = usePanelOutOfView(panelRef);

  const clusteringQuery = useQuery<ClusteringResponse, ApiError>({
    queryKey: [CLUSTERING_QUERY_KEY_PREFIX, representation, selectedLinkages] as const,
    queryFn: () => {
      const body: ClusteringRequestBody = { representation, linkages: selectedLinkages };
      return runClustering(body);
    },
    enabled: hasLinkagesSelected,
  });

  const activeCutResult =
    cutResult &&
    cutResult.representation === representation &&
    cutResult.linkages.join(',') === selectedLinkages.join(',')
      ? cutResult
      : undefined;

  // Display-only: supplies each dendrogram leaf's title. Never used for
  // `k_ref`/ranking (see the doc comment above) and never used to derive a
  // leaf's identity — that comes from each linkage result's own
  // `documentIds` (`leafLabels.ts`). A fetch failure here just
  // means no title, the same "don't block on secondary data" reasoning the
  // matrix headers use; the document id itself is always shown.
  const corpusQuery = useQuery<ListCorpusResponse, ApiError>({
    queryKey: CORPUS_LIST_QUERY_KEY,
    queryFn: fetchCorpus,
  });

  // No `onSuccess`/`onError` here: TanStack Query's `useMutation` config is
  // recreated every render, but a mutation's own `onSuccess`/`onError`
  // there run against whichever render produced them *by the time the
  // request settles* — not the render that submitted it. Reading component
  // state (`selectedLinkages`) from there would attribute a cut to
  // whatever the selection happens to be when the promise resolves, not to
  // the selection the user actually cut. `handleCutSubmit` below passes
  // per-call callbacks to `mutate()` instead, closing over the submitted
  // selection explicitly.
  const cutMutation = useMutation<ClusteringCutResponse, ApiError, ClusteringCutRequestBody>({
    // Wrapped (not passed directly) so `cutClustering` is invoked with only
    // its own request body, never react-query's own second `context`
    // argument.
    mutationFn: (body) => cutClustering(body),
  });

  const activeCutError =
    cutMutation.error &&
    cutErrorContext &&
    cutErrorContext.representation === representation &&
    cutErrorContext.linkages.join(',') === selectedLinkages.join(',')
      ? cutMutation.error
      : undefined;

  const toggleLinkage = (id: string) => {
    const linkageId = id as LinkageId;
    setSelectedLinkages((previous) =>
      previous.includes(linkageId)
        ? previous.filter((existing) => existing !== linkageId)
        : [...previous, linkageId],
    );
  };

  const sampleSize = useMemo(() => {
    if (!clusteringQuery.data) {
      return undefined;
    }
    return sampleSizeFromResponse(clusteringQuery.data);
  }, [clusteringQuery.data]);

  const kRef = useMemo(() => {
    if (sampleSize === undefined) {
      return undefined;
    }
    try {
      return kRefForSampleSize(sampleSize);
    } catch {
      return undefined;
    }
  }, [sampleSize]);

  const ranking = useMemo(() => {
    if (
      kRef === undefined ||
      !clusteringQuery.data ||
      !hasCanonicalLinkageIds(clusteringQuery.data.map((result) => result.linkageId))
    ) {
      return undefined;
    }
    try {
      return rankClusteringLinkages(metricsAtKRef(clusteringQuery.data, kRef));
    } catch {
      // The ranking rule requires exactly the four canonical linkages with
      // finite metrics. A non-conforming response (e.g.
      // malformed data) just means no leader is marked — every metric tile
      // is still shown from the raw response.
      return undefined;
    }
  }, [clusteringQuery.data, kRef]);

  /** Corpus title lookup by id (never by position) for `leafLabelsFromDocumentIds`. */
  const corpusTitleById = useMemo(() => {
    if (!corpusQuery.data) {
      return undefined;
    }
    return new Map(corpusQuery.data.map((document) => [document.id, document.title] as const));
  }, [corpusQuery.data]);

  const selectAllLinkages = () => setSelectedLinkages([...LINKAGE_IDS]);

  const cutLinkageIds = clusteringQuery.data?.map((result) => result.linkageId) ?? [];
  const cutLinkage =
    cutLinkageChoice !== undefined && cutLinkageIds.includes(cutLinkageChoice)
      ? cutLinkageChoice
      : cutLinkageIds[0];

  const handleCutSubmit = () => {
    if (cutLinkage === undefined || sampleSize === undefined || !isValidCutK(cutK, sampleSize)) {
      return;
    }
    // Captured here, at submit time, rather than read from component state
    // inside the mutation's callbacks below (see the doc comment on
    // `cutMutation`) — a linkage toggled while this request is still in
    // flight must never change which selection the result gets attributed to.
    const submittedLinkages = selectedLinkages;

    cutMutation.mutate(
      { representation, linkage: cutLinkage, k: cutK },
      {
        onSuccess: (data, variables) => {
          setCutResult({
            // `variables.representation` is always this page's own state
            // (never omitted), but the generated request type allows `null`
            // for an absent body field — narrow back to the page's own
            // default.
            representation: variables.representation ?? DEFAULT_REPRESENTATION,
            linkages: submittedLinkages,
            linkageId: variables.linkage,
            k: data.k,
            labels: data.labels,
            documentIds: data.documentIds,
          });
        },
        onError: (_error, variables) => {
          setCutErrorContext({
            representation: variables.representation ?? DEFAULT_REPRESENTATION,
            linkages: submittedLinkages,
          });
        },
      },
    );
  };

  /** Scrolls the parameter panel back into view (instantly under reduced
   * motion) and moves focus to its first control. */
  const editParameters = () => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.scrollIntoView?.({ block: 'start', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    panel
      .querySelector<HTMLElement>('[role="radio"][aria-checked="true"], button:not([disabled])')
      ?.focus({ preventScroll: true });
  };

  const appliedCut = activeCutResult && {
    linkageId: activeCutResult.linkageId,
    k: activeCutResult.k,
  };

  const cutColumn: CutColumnState = !hasLinkagesSelected
    ? { status: 'unavailable', reason: 'no-linkage' }
    : clusteringQuery.data && sampleSize !== undefined && cutLinkage !== undefined
      ? {
          status: 'ready',
          linkages: clusteringQuery.data.map((result) => ({
            id: result.linkageId,
            displayName: result.linkageDisplayName,
          })),
          n: sampleSize,
          kRef,
          linkage: cutLinkage,
          onLinkageChange: setCutLinkageChoice,
          k: cutK,
          onKChange: setCutK,
          onApply: handleCutSubmit,
          isPending: cutMutation.isPending,
          error: activeCutError,
        }
      : clusteringQuery.isPending
        ? {
            status: 'pending',
            sampleSizeEstimate: corpusQuery.data?.length ?? DEFAULT_SKELETON_LEAF_COUNT,
          }
        : { status: 'unavailable', reason: 'error' };

  return (
    <div data-testid="clustering-page">
      <ParametersSummaryBar
        visible={panelOutOfView}
        representation={representation}
        linkages={selectedLinkages}
        appliedCut={appliedCut}
        onEdit={editParameters}
      />
      <div className="flex flex-col gap-6">
        <PanelHeader eyebrow={t('clustering.eyebrow')} title={t('clustering.title')} />

        <ClusteringParametersPanel
          panelRef={panelRef}
          representation={representation}
          onRepresentationChange={setRepresentation}
          selectedLinkages={selectedLinkages}
          onToggleLinkage={toggleLinkage}
          onSelectAllLinkages={selectAllLinkages}
          cut={cutColumn}
          appliedCut={appliedCut}
          onClearCut={() => setCutResult(undefined)}
        />

        {clusteringQuery.isPending && hasLinkagesSelected && (
          <>
            <p role="status" className="sr-only">
              {t('clustering.loading')}
            </p>
            <ClusteringMetricsTableSkeleton
              linkageIds={selectedLinkages}
              representation={representation}
              sampleSizeEstimate={corpusQuery.data?.length ?? DEFAULT_SKELETON_LEAF_COUNT}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {selectedLinkages.map((linkageId) => (
                <DendrogramCardSkeleton
                  key={linkageId}
                  linkageId={linkageId}
                  height={dendrogramCardHeight(
                    corpusQuery.data?.length ?? DEFAULT_SKELETON_LEAF_COUNT,
                  )}
                />
              ))}
            </div>
          </>
        )}
        {clusteringQuery.isError && (
          <Alert
            tone="danger"
            title={t('clustering.errorTitle')}
            body={t(clusteringQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          />
        )}

        {clusteringQuery.data && (
          <ClusteringMetricsTable
            results={clusteringQuery.data}
            kRef={kRef}
            ranking={ranking}
            representation={representation}
            sampleSize={sampleSize}
          />
        )}

        {clusteringQuery.data && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {clusteringQuery.data.map((linkageResult) => (
              <DendrogramCard
                key={linkageResult.linkageId}
                linkageId={linkageResult.linkageId}
                linkageDisplayName={linkageResult.linkageDisplayName}
                rows={linkageResult.rows}
                leafOrder={linkageResult.leafOrder}
                leafLabels={leafLabelsFromDocumentIds(linkageResult.documentIds, corpusTitleById)}
                cut={
                  activeCutResult?.linkageId === linkageResult.linkageId
                    ? {
                        // Derived here, not stored on `cutResult`: it depends
                        // on whichever `rows` are currently loaded for this
                        // exact linkage, and it must never throw a successful
                        // cut into an error state — a distance that can't be
                        // resolved just means no dashed line, the labels below
                        // still render (`tryComputeCutDistance`).
                        distance: tryComputeCutDistance(linkageResult.rows, activeCutResult.k),
                        // Joined by document id (`cutLabels.ts`), never by
                        // array position: the cut response's own `documentIds`
                        // need not share positions with this linkage's own
                        // `documentIds`.
                        labels: resolveCutLabelsForLinkage(
                          activeCutResult,
                          linkageResult.documentIds,
                        ),
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
