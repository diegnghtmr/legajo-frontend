import { useId, useState, type CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { ClusteringResponse } from '../../infrastructure/api/clustering';
import type { LinkageId, RepresentationId } from '../../infrastructure/schemas/clustering';
import { Panel } from '../../shared/components/Panel';
import {
  SegmentedControl,
  SegmentedControlSkeleton,
  type SegmentedOption,
} from '../../shared/components/SegmentedControl';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { LeaderBadge } from './LeaderBadge';
import { barFraction, columnBest, metricSeries } from './metricBars';
import { MetricCell } from './MetricCell';
import {
  METRICS_TABLE_CLASS_NAME,
  METRICS_TABLE_MIN_WIDTH,
  MetricsTableColumns,
} from './MetricsTableColumns';
import { fixedKOptions, orderLinkagesForMetricsTable } from './metricsTable';
import { kRefForSampleSize, type ClusteringRankingResult } from './ranking';

/** `kRefForSampleSize`'s own fixed-cut set (`{2,3,4,5} ∩ [2, n-1]`) —
 * mirrored here only to lay out the skeleton's own "view at k" selector,
 * never to compute a real value. */
const FIXED_CUTS = [2, 3, 4, 5];

/** The stagger index stops growing here: later rows share the last delay. */
const MAX_STAGGER_INDEX = 11;

const HEADER_CELL_CLASS_NAME = 'p-2 text-eyebrow uppercase tracking-wide text-ink-secondary';

/** The real per-linkage display names, captured against the reference
 * corpus: a fixed "<Name> linkage" shape for each canonical id. Used only to
 * size the skeleton's invisible name line to the real one. */
const TYPICAL_LINKAGE_DISPLAY_NAME: Record<string, string> = {
  single: 'Single linkage',
  complete: 'Complete linkage',
  average: 'Average linkage',
  ward: 'Ward linkage',
};

/** Two linkage ids of typical length for the skeleton's leader-line sizer. */
const TYPICAL_TREE_LEADER = 'average';
const TYPICAL_PARTITION_LEADER = 'complete';

/** The fixed cuts a corpus of `sampleSizeEstimate` documents is likely to
 * carry: the sizing aid behind the skeleton's selector, never a real value. */
function estimatedFixedKs(sampleSizeEstimate: number): number[] {
  if (!Number.isInteger(sampleSizeEstimate) || sampleSizeEstimate < 3) {
    return [];
  }
  return FIXED_CUTS.filter((k) => k <= sampleSizeEstimate - 1);
}

/** `kRefForSampleSize`'s own estimated value, or `undefined` below its own
 * valid domain — used to label the columns before the response is known. */
function estimatedKRef(sampleSizeEstimate: number): number | undefined {
  return Number.isInteger(sampleSizeEstimate) && sampleSizeEstimate >= 3
    ? kRefForSampleSize(sampleSizeEstimate)
    : undefined;
}

export interface ClusteringMetricsTableProps {
  results: ClusteringResponse;
  /** `undefined` only for a malformed response the linkages disagree on
   * (`sampleSizeFromResponse`/`kRefForSampleSize` in `ranking.ts`) — there is
   * no principled "k_ref" to lead the table's columns with, so the table
   * itself is skipped entirely rather than guessing one; the explanatory
   * text below still renders. */
  kRef: number | undefined;
  ranking: ClusteringRankingResult | undefined;
  representation: RepresentationId;
  sampleSize: number | undefined;
}

/**
 * The metrics comparison card: a "view at k" selector over the cuts the
 * response carries, one row per linkage in the fixed declaration order
 * (cophenetic, then silhouette and Davies–Bouldin at the viewed k, each with
 * an inline bar; the last two with a sparkline across k), the leader badges,
 * and a footer with the plain-language leader line and the caveat. Leaders
 * are always computed at `k_ref`, whatever k is viewed. This only renders the
 * backend's own already-computed numbers (`ranking.ts`'s leader rule,
 * `formatMetricValue`'s own formatting) — it never recomputes a metric.
 */
export function ClusteringMetricsTable({
  results,
  kRef,
  ranking,
  representation,
  sampleSize,
}: ClusteringMetricsTableProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const viewLabelId = useId();
  const [viewKChoice, setViewKChoice] = useState<number | undefined>(undefined);
  const orderedResults = orderLinkagesForMetricsTable(results);
  const kOptions = fixedKOptions(results);
  const viewK = viewKChoice !== undefined && kOptions.includes(viewKChoice) ? viewKChoice : kRef;

  const kSelectorOptions: readonly SegmentedOption<string>[] = kOptions.map((k) => ({
    value: String(k),
    label: (
      <span className="font-mono">{k === kRef ? t('clustering.metrics.refOption', { k }) : k}</span>
    ),
  }));

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={titleId} className="text-title font-semibold text-ink">
          {t('clustering.metrics.title')}
        </h2>
        {kRef !== undefined && kOptions.length > 0 && viewK !== undefined && (
          <div className="flex items-center gap-2">
            <span id={viewLabelId} className="text-label text-ink-secondary">
              {t('clustering.metrics.viewAtK')}
            </span>
            <SegmentedControl
              size="sm"
              options={kSelectorOptions}
              value={String(viewK)}
              onChange={(value) => setViewKChoice(Number(value))}
              aria-labelledby={viewLabelId}
            />
          </div>
        )}
      </div>

      {kRef !== undefined && viewK !== undefined && (
        <ClusteringMetricsTableBody
          orderedResults={orderedResults}
          ranking={ranking}
          viewK={viewK}
        />
      )}

      <div className="mt-3 flex flex-col gap-1.5 border-t border-hairline pt-3">
        <p data-testid="metrics-leader-line" className="text-label text-ink-secondary">
          {ranking && kRef !== undefined ? (
            <>
              <Trans
                i18nKey="clustering.leaderLine"
                values={{
                  tree: ranking.bestTreeFidelity,
                  kRef,
                  partition: ranking.bestPartitionAtKRef,
                }}
                components={{ strong: <strong className="font-semibold text-ink" /> }}
              />
              {ranking.copheneticTieSet.length > 1 && (
                <> {t('clustering.tieSet', { linkages: ranking.copheneticTieSet.join(', ') })}</>
              )}
            </>
          ) : (
            t('clustering.leadersRequireAllLinkages')
          )}
        </p>

        {sampleSize !== undefined && (
          <p className="text-label text-ink-muted">
            {t('clustering.sampleSizeCaveat', { representation, count: sampleSize })}
          </p>
        )}
      </div>
    </Panel>
  );
}

interface ClusteringMetricsTableBodyProps {
  orderedResults: ClusteringResponse;
  ranking: ClusteringRankingResult | undefined;
  viewK: number;
}

/** The table itself, split out so the parent only needs a resolved `kRef`
 * to render it — the explanatory text below stays independent of whether a
 * `kRef` could be resolved at all. */
function ClusteringMetricsTableBody({
  orderedResults,
  ranking,
  viewK,
}: ClusteringMetricsTableBodyProps) {
  const { t } = useTranslation();
  const viewKey = String(viewK);
  const silhouettes = orderedResults.map((result) => result.evaluation.meanSilhouette[viewKey]);
  const daviesBouldins = orderedResults.map((result) => result.evaluation.daviesBouldin[viewKey]);
  const bestCophenetic = columnBest(
    orderedResults.map((result) => result.evaluation.cophenetic),
    'higher',
  );
  const bestSilhouette = columnBest(silhouettes, 'higher');
  const bestDaviesBouldin = columnBest(daviesBouldins, 'lower');

  return (
    <div className="mb-3">
      {/* `relative`: the visually hidden sparkline sentences are absolutely
          positioned, and only a positioned scroll container clips them —
          otherwise a sentence in a scrolled-away column widens the page. */}
      <div
        role="region"
        aria-label={t('clustering.metricsTable.regionLabel')}
        tabIndex={0}
        className="relative overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <table className={METRICS_TABLE_CLASS_NAME} style={{ minWidth: METRICS_TABLE_MIN_WIDTH }}>
          <MetricsTableColumns />
          <caption className="sr-only">{t('clustering.metricsTable.caption')}</caption>
          <thead>
            <tr className="border-b border-hairline bg-paper-sunken">
              <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                {t('clustering.metricsTable.linkageHeader')}
              </th>
              <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                {t('clustering.metrics.copheneticHeader')}
              </th>
              <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                {t('clustering.metrics.silhouetteHeader', { k: viewK })}
              </th>
              <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                {t('clustering.metrics.daviesBouldinHeader', { k: viewK })}
              </th>
              <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                {t('clustering.leader')}
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedResults.map((result, index) => {
              const silhouette = silhouettes[index];
              const daviesBouldin = daviesBouldins[index];
              const isTreeLeader = ranking?.bestTreeFidelity === result.linkageId;
              const isPartitionLeader =
                ranking?.leadersDiffer === true && ranking.bestPartitionAtKRef === result.linkageId;

              return (
                <tr
                  key={result.linkageId}
                  data-testid={`metrics-row-${result.linkageId}`}
                  className="enter-rise border-b border-hairline"
                  style={{ '--i': Math.min(index, MAX_STAGGER_INDEX) } as CSSProperties}
                >
                  <td className="p-2">
                    <div className="flex flex-col">
                      <span className="text-body font-medium text-ink">
                        {result.linkageDisplayName}
                      </span>
                      <span className="font-mono text-mono text-ink-muted">{result.linkageId}</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <MetricCell
                      value={result.evaluation.cophenetic}
                      fraction={barFraction(result.evaluation.cophenetic, bestCophenetic, 'higher')}
                      index={index}
                    />
                  </td>
                  <td className="p-2">
                    <MetricCell
                      value={silhouette ?? null}
                      fraction={barFraction(silhouette, bestSilhouette, 'higher')}
                      index={index}
                      series={metricSeries(result.evaluation.meanSilhouette)}
                      activeK={viewK}
                    />
                  </td>
                  <td className="p-2">
                    <MetricCell
                      value={daviesBouldin ?? null}
                      fraction={barFraction(daviesBouldin, bestDaviesBouldin, 'lower')}
                      index={index}
                      series={metricSeries(result.evaluation.daviesBouldin)}
                      activeK={viewK}
                    />
                  </td>
                  <td className="p-2">
                    {isTreeLeader || isPartitionLeader ? (
                      <div className="flex flex-wrap gap-1.5">
                        {isTreeLeader && <LeaderBadge kind="tree" />}
                        {isPartitionLeader && <LeaderBadge kind="partition" />}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface ClusteringMetricsTableSkeletonProps {
  /** One row per selected linkage. */
  linkageIds: readonly LinkageId[];
  /** Already known before the request resolves (the page's own current
   * selection) — used only to size the invisible sizer below, never shown. */
  representation: RepresentationId;
  /** The count the caveat's own invisible sizer below is built from. The
   * clustering request carries no document selection of its own (unlike
   * similarity's compare/matrix requests) — it always runs over the whole
   * loaded corpus — so the corpus-list query's own count (once it has
   * resolved; the caller falls back to a reasonable default before it has)
   * already equals the sample size the response will report, without
   * waiting for that response. This is a sizing aid only: `ranking.ts`'s
   * own `sampleSizeFromResponse` still reads the real count from the
   * response alone for anything that actually marks a leader. */
  sampleSizeEstimate: number;
}

/** A skeleton block laid over an invisible sizer, so the line keeps the
 * height (and wrap) of the real text it stands in for. */
function SizedSkeletonLine({ sizer }: { sizer: string }) {
  return (
    <div className="relative">
      <p aria-hidden="true" className="invisible text-label">
        {sizer}
      </p>
      <Skeleton className="absolute inset-x-0 top-0 h-[17px]" />
    </div>
  );
}

/** Mirrors `ClusteringMetricsTable`'s own card: the real title and "view at
 * k" label, the table shell and real headers, one skeleton row per selected
 * linkage, and the footer's two lines. */
export function ClusteringMetricsTableSkeleton({
  linkageIds,
  representation,
  sampleSizeEstimate,
}: ClusteringMetricsTableSkeletonProps) {
  const { t } = useTranslation();
  const kRefEstimate = estimatedKRef(sampleSizeEstimate);
  const ks = estimatedFixedKs(sampleSizeEstimate);
  const leaderSizer = t('clustering.leaderLine', {
    tree: TYPICAL_TREE_LEADER,
    kRef: kRefEstimate ?? '',
    partition: TYPICAL_PARTITION_LEADER,
  }).replace(/<\/?strong>/g, '');

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-title font-semibold text-ink">{t('clustering.metrics.title')}</h2>
        {ks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-label text-ink-secondary">{t('clustering.metrics.viewAtK')}</span>
            <SegmentedControlSkeleton
              size="sm"
              labels={ks.map((k) => (
                <span key={k} className="font-mono">
                  {k === kRefEstimate ? t('clustering.metrics.refOption', { k }) : k}
                </span>
              ))}
            />
          </div>
        )}
      </div>

      <div className="mb-3">
        <div className="overflow-hidden rounded-md">
          <table className={METRICS_TABLE_CLASS_NAME} style={{ minWidth: METRICS_TABLE_MIN_WIDTH }}>
            <MetricsTableColumns />
            <caption className="sr-only">{t('clustering.metricsTable.caption')}</caption>
            <thead>
              <tr className="border-b border-hairline bg-paper-sunken">
                <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                  {t('clustering.metricsTable.linkageHeader')}
                </th>
                <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                  {t('clustering.metrics.copheneticHeader')}
                </th>
                {/* `k_ref` comes from the sample-size estimate (the corpus
                 * size, which is what the response will report), so the
                 * header reads exactly as the loaded one does. */}
                <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                  {kRefEstimate === undefined
                    ? t('clustering.metrics.silhouetteHeaderPending')
                    : t('clustering.metrics.silhouetteHeader', { k: kRefEstimate })}
                </th>
                <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                  {kRefEstimate === undefined
                    ? t('clustering.metrics.daviesBouldinHeaderPending')
                    : t('clustering.metrics.daviesBouldinHeader', { k: kRefEstimate })}
                </th>
                <th scope="col" className={HEADER_CELL_CLASS_NAME}>
                  {t('clustering.leader')}
                </th>
              </tr>
            </thead>
            <tbody>
              {linkageIds.map((linkageId) => (
                <tr
                  key={linkageId}
                  data-testid={`metrics-row-skeleton-${linkageId}`}
                  className="border-b border-hairline"
                >
                  <td className="p-2">
                    <div className="flex flex-col">
                      {/* The real name line ("Complete linkage") is text at
                       * the body role; an invisible sizer of the same text
                       * reserves its height and wrap, and a block stands in
                       * for it. The mono id below it is already known. */}
                      <span className="relative block text-body font-medium">
                        <span aria-hidden="true" className="invisible">
                          {TYPICAL_LINKAGE_DISPLAY_NAME[linkageId] ?? linkageId}
                        </span>
                        <Skeleton className="absolute inset-y-0.5 left-0 w-28" />
                      </span>
                      <span className="font-mono text-mono text-ink-muted">{linkageId}</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <SkeletonMetricCell />
                  </td>
                  <td className="p-2">
                    <SkeletonMetricCell withSparkline />
                  </td>
                  <td className="p-2">
                    <SkeletonMetricCell withSparkline />
                  </td>
                  <td className="p-2">
                    <Skeleton className="h-6 w-20 rounded-btn" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* The real footer's two lines: the leader sentence (a typical one) and
       * the caveat, each behind an invisible sizer built from its real text,
       * so the wrap point is the one the loaded footer reaches. */}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-hairline pt-3">
        <SizedSkeletonLine sizer={leaderSizer} />
        <SizedSkeletonLine
          sizer={t('clustering.sampleSizeCaveat', { representation, count: sampleSizeEstimate })}
        />
      </div>
    </Panel>
  );
}

function SkeletonMetricCell({ withSparkline = false }: { withSparkline?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="h-[17px] w-14" />
      <Skeleton className="h-1.5 w-[72px] shrink-0 rounded-full" />
      {withSparkline && <Skeleton className="h-[18px] w-[60px] shrink-0" />}
    </div>
  );
}
