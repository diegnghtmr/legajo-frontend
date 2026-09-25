import { useMemo, useState } from 'react';
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
import {
  LinkageIdSchema,
  RepresentationIdSchema,
  type LinkageId,
  type RepresentationId,
} from '../../infrastructure/schemas/clustering';
import { AlgoTextList, type AlgoOption } from '../../shared/components/AlgoTextList';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';
import { CORPUS_LIST_QUERY_KEY } from '../corpus/SelectionRail';
import { ClusteringMetricsTable } from './ClusteringMetricsTable';
import { resolveCutLabelsForLinkage } from './cutLabels';
import { tryComputeCutDistance } from './cutLine';
import { CutForm, type CutFormValues } from './CutForm';
import { DendrogramCard } from './DendrogramCard';
import { leafLabelsFromDocumentIds } from './leafLabels';
import {
  hasCanonicalLinkageIds,
  kRefForSampleSize,
  metricsAtKRef,
  rankClusteringLinkages,
  sampleSizeFromResponse,
} from './ranking';

const REPRESENTATION_IDS = [...RepresentationIdSchema.options];
const DEFAULT_REPRESENTATION: RepresentationId = 'tfidf-cosine';
const REPRESENTATION_OPTIONS: readonly SegmentedOption<RepresentationId>[] = REPRESENTATION_IDS.map(
  (id) => ({ value: id, label: <span className="font-mono">{id}</span> }),
);

/** The four fixed linkage criteria; no family concept for linkages. */
const LINKAGE_IDS = [...LinkageIdSchema.options];
const LINKAGE_OPTIONS: readonly AlgoOption[] = LINKAGE_IDS.map((id) => ({ id }));

const CLUSTERING_QUERY_KEY_PREFIX = 'clustering';

/**
 * Clustering screen: one control bar card at the top (representation
 * Segmented, linkage selection, and the free-cut group — linkage to cut, k,
 * `Aplicar corte`), the metrics comparison table applying the fixed ranking
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

  const handleCutSubmit = (values: CutFormValues) => {
    // Captured here, at submit time, rather than read from component state
    // inside the mutation's callbacks below (see the doc comment on
    // `cutMutation`) — a linkage toggled while this request is still in
    // flight must never change which selection the result gets attributed to.
    const submittedLinkages = selectedLinkages;

    cutMutation.mutate(
      { representation, linkage: values.linkage, k: values.k },
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

  return (
    <div className="flex flex-col gap-6">
      <PanelHeader eyebrow={t('clustering.eyebrow')} title={t('clustering.title')} />

      {/* One control bar card: representation, linkage selection and the
          free-cut group sit together and wrap onto new lines as the width
          shrinks — the bar itself never scrolls horizontally. */}
      <Panel>
        <div className="flex flex-wrap items-start gap-6">
          <SegmentedControl
            options={REPRESENTATION_OPTIONS}
            value={representation}
            onChange={setRepresentation}
            aria-label={t('clustering.representationGroupLabel')}
          />

          <AlgoTextList
            options={LINKAGE_OPTIONS}
            selectedIds={selectedLinkages}
            onToggle={toggleLinkage}
            aria-label={t('clustering.linkageGroupLabel')}
          />

          <div className="min-w-[260px] flex-1">
            {clusteringQuery.data && sampleSize !== undefined ? (
              <CutForm
                // Remounts (resetting react-hook-form's own default value)
                // when the set of available linkages actually changes, so a
                // stale default never lingers after the user deselects one.
                key={clusteringQuery.data.map((result) => result.linkageId).join(',')}
                linkages={clusteringQuery.data.map((result) => ({
                  id: result.linkageId,
                  displayName: result.linkageDisplayName,
                }))}
                n={sampleSize}
                defaultLinkage={clusteringQuery.data[0]!.linkageId}
                onSubmit={handleCutSubmit}
                isPending={cutMutation.isPending}
                error={activeCutError}
              />
            ) : (
              <p className="text-body text-ink-muted">
                {/*
                 * The placeholder shown while no `CutForm` can be rendered
                 * must name the actual reason: nothing is selected, the
                 * request failed, or it is still loading. Showing the
                 * "still loading" copy for the first two would be false —
                 * nothing is loading, and reselecting a linkage (not
                 * waiting) is what unblocks the cut in each case.
                 */}
                {!hasLinkagesSelected
                  ? t('clustering.cutForm.unavailableNoLinkage')
                  : clusteringQuery.isError
                    ? t('clustering.cutForm.unavailableError')
                    : t('clustering.cutForm.unavailable')}
              </p>
            )}
          </div>
        </div>

        {!hasLinkagesSelected && (
          <p className="mt-3 text-body text-ink-secondary">{t('clustering.noLinkages')}</p>
        )}
      </Panel>

      {clusteringQuery.isPending && hasLinkagesSelected && (
        <p role="status" className="text-body text-ink-secondary">
          {t('clustering.loading')}
        </p>
      )}
      {clusteringQuery.isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">{t('clustering.errorTitle')}</p>
          <p className="text-body text-ink-secondary">
            {t(clusteringQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
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
  );
}
