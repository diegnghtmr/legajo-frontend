import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  runClustering,
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
import { MetricTile } from '../../shared/components/MetricTile';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';
import { CORPUS_LIST_QUERY_KEY } from '../corpus/ArticleList';
import { formatMetricValue } from './formatMetricValue';
import { kRefForSampleSize, metricsAtKRef, rankClusteringLinkages } from './ranking';

const REPRESENTATION_IDS = [...RepresentationIdSchema.options];
const DEFAULT_REPRESENTATION: RepresentationId = 'tfidf-cosine';
const REPRESENTATION_OPTIONS: readonly SegmentedOption<RepresentationId>[] = REPRESENTATION_IDS.map(
  (id) => ({ value: id, label: <span className="font-mono">{id}</span> }),
);

/** The four fixed linkage criteria (TRD §6.4); no family concept for linkages. */
const LINKAGE_IDS = [...LinkageIdSchema.options];
const LINKAGE_OPTIONS: readonly AlgoOption[] = LINKAGE_IDS.map((id) => ({ id }));

const CLUSTERING_QUERY_KEY_PREFIX = 'clustering';

/**
 * Reads the fixed cuts of one linkage's evaluation, sorted ascending by `k`,
 * for a stable, deterministic render order (object key order is not part of
 * the JSON contract).
 */
function sortedCuts<TValue>(record: Record<string, TValue>): Array<[string, TValue]> {
  return Object.entries(record).sort(([a], [b]) => Number(a) - Number(b));
}

/**
 * Clustering screen (DESIGN.md §6.4, PRD HU-2.2, TAC-04): representation and
 * linkage selection, `POST /clustering`, and the metrics strip applying the
 * TRD §6.5 ranking rule over the backend's own numbers (`ranking.ts`).
 * Reads the corpus list only for its size `n` (the sample-size caveat and
 * `k_ref`); a corpus-fetch failure degrades to no leader marks rather than
 * blocking the metrics themselves, same reasoning as W7's matrix headers.
 *
 * The dendrograms and the free cut (`POST /clustering/cut`) are W8b's slot,
 * marked per linkage below — D3 only draws from `rows`/`leafOrder`, never
 * computed here.
 */
export function ClusteringPage() {
  const { t } = useTranslation();
  const [representation, setRepresentation] = useState<RepresentationId>(DEFAULT_REPRESENTATION);
  const [selectedLinkages, setSelectedLinkages] = useState<LinkageId[]>([...LINKAGE_IDS]);
  const hasLinkagesSelected = selectedLinkages.length > 0;

  const corpusQuery = useQuery<ListCorpusResponse, ApiError>({
    queryKey: CORPUS_LIST_QUERY_KEY,
    queryFn: fetchCorpus,
  });
  const sampleSize = corpusQuery.data?.length;

  const clusteringQuery = useQuery<ClusteringResponse, ApiError>({
    queryKey: [CLUSTERING_QUERY_KEY_PREFIX, representation, selectedLinkages] as const,
    queryFn: () => {
      const body: ClusteringRequestBody = { representation, linkages: selectedLinkages };
      return runClustering(body);
    },
    enabled: hasLinkagesSelected,
  });

  const toggleLinkage = (id: string) => {
    const linkageId = id as LinkageId;
    setSelectedLinkages((previous) =>
      previous.includes(linkageId)
        ? previous.filter((existing) => existing !== linkageId)
        : [...previous, linkageId],
    );
  };

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
    if (kRef === undefined || !clusteringQuery.data || clusteringQuery.data.length !== 4) {
      return undefined;
    }
    try {
      return rankClusteringLinkages(metricsAtKRef(clusteringQuery.data, kRef));
    } catch {
      // The ranking rule requires exactly the four canonical linkages with
      // finite metrics (TRD §6.4/§6.5). A non-conforming response (e.g. a
      // partial linkage selection, or malformed data) just means no leader
      // is marked — every metric tile is still shown from the raw response.
      return undefined;
    }
  }, [clusteringQuery.data, kRef]);

  return (
    <div className="flex flex-col gap-6">
      <PanelHeader eyebrow={t('clustering.eyebrow')} title={t('clustering.title')} />

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

      {!hasLinkagesSelected && (
        <p className="text-body text-ink-secondary">{t('clustering.noLinkages')}</p>
      )}

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
        <div className="flex flex-col gap-4">
          {clusteringQuery.data.map((linkageResult) => {
            const isTreeLeader = ranking?.bestTreeFidelity === linkageResult.linkageId;
            const isPartitionLeader = ranking?.bestPartitionAtKRef === linkageResult.linkageId;

            return (
              <div
                key={linkageResult.linkageId}
                data-testid={`linkage-panel-${linkageResult.linkageId}`}
              >
                <Panel>
                  <PanelHeader title={linkageResult.linkageDisplayName} />

                  <div className="flex flex-wrap gap-3">
                    <MetricTile
                      label={t('clustering.metrics.cophenetic')}
                      value={formatMetricValue(linkageResult.evaluation.cophenetic)}
                      leader={isTreeLeader}
                      leaderLabel={
                        ranking?.leadersDiffer ? t('clustering.leaderTree') : t('clustering.leader')
                      }
                    />

                    {sortedCuts(linkageResult.evaluation.meanSilhouette).map(([k, value]) => (
                      <MetricTile
                        key={`silhouette-${k}`}
                        label={t('clustering.metrics.silhouetteAtK', { k })}
                        value={formatMetricValue(value)}
                        leader={Boolean(
                          ranking?.leadersDiffer &&
                          isPartitionLeader &&
                          kRef !== undefined &&
                          Number(k) === kRef,
                        )}
                        leaderLabel={t('clustering.leaderPartition')}
                      />
                    ))}

                    {sortedCuts(linkageResult.evaluation.daviesBouldin).map(([k, value]) => (
                      <MetricTile
                        key={`db-${k}`}
                        label={t('clustering.metrics.daviesBouldinAtK', { k })}
                        value={
                          value === null
                            ? t('clustering.metrics.undefinedValue')
                            : formatMetricValue(value)
                        }
                      />
                    ))}
                  </div>

                  <p
                    className="mt-3 text-label text-ink-muted"
                    data-testid={`dendrogram-slot-${linkageResult.linkageId}`}
                  >
                    {t('clustering.dendrogramSlot')}
                  </p>
                </Panel>
              </div>
            );
          })}

          {ranking && ranking.copheneticTieSet.length > 1 && (
            <p className="text-body text-ink-secondary">
              {t('clustering.tieSet', { linkages: ranking.copheneticTieSet.join(', ') })}
            </p>
          )}
        </div>
      )}

      {sampleSize !== undefined && (
        <p className="text-body text-ink-muted">
          {t('clustering.sampleSizeCaveat', { representation, count: sampleSize })}
        </p>
      )}
    </div>
  );
}
