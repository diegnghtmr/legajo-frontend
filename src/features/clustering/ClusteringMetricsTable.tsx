import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import type { ClusteringResponse } from '../../infrastructure/api/clustering';
import type { LinkageId, RepresentationId } from '../../infrastructure/schemas/clustering';
import { Panel } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { cn } from '../../shared/lib/cn';
import { formatMetricValue } from './formatMetricValue';
import { orderLinkagesForMetricsTable, secondaryFixedKColumns } from './metricsTable';
import type { ClusteringRankingResult } from './ranking';

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

const HIGHLIGHT_CLASS_NAME = 'bg-paper-sunken';

function daviesBouldinCellText(value: number | null | undefined, undefinedLabel: string): string {
  return value === null || value === undefined ? undefinedLabel : formatMetricValue(value);
}

function silhouetteCellText(value: number | undefined, undefinedLabel: string): string {
  return value === undefined ? undefinedLabel : formatMetricValue(value);
}

/**
 * The clustering metrics comparison table: one row per linkage in the fixed
 * declaration order, lead columns for Cophenetic and for
 * Silhouette/Davies–Bouldin at `k_ref` (highlighted), and a secondary column
 * group for every other fixed cut the response carries (`metricsTable.ts`).
 * This only renders the backend's own already-computed numbers
 * (`ranking.ts`'s leader rule, `formatMetricValue`'s own formatting) — it
 * never recomputes a metric itself.
 */
export function ClusteringMetricsTable({
  results,
  kRef,
  ranking,
  representation,
  sampleSize,
}: ClusteringMetricsTableProps) {
  const { t } = useTranslation();
  const orderedResults = orderLinkagesForMetricsTable(results);
  const undefinedLabel = t('clustering.metrics.undefinedValue');

  return (
    <Panel>
      {kRef !== undefined && (
        <ClusteringMetricsTableBody
          orderedResults={orderedResults}
          results={results}
          kRef={kRef}
          ranking={ranking}
          undefinedLabel={undefinedLabel}
        />
      )}

      {ranking ? (
        ranking.copheneticTieSet.length > 1 && (
          <p className="mt-3 text-body text-ink-secondary">
            {t('clustering.tieSet', { linkages: ranking.copheneticTieSet.join(', ') })}
          </p>
        )
      ) : (
        <p className="mt-3 text-body text-ink-secondary">
          {t('clustering.leadersRequireAllLinkages')}
        </p>
      )}

      {sampleSize !== undefined && (
        <p className="mt-3 text-body text-ink-muted">
          {t('clustering.sampleSizeCaveat', { representation, count: sampleSize })}
        </p>
      )}
    </Panel>
  );
}

export interface ClusteringMetricsTableSkeletonProps {
  /** One row per selected linkage — the secondary per-k column group
   * depends on the backend's own response and stays out of this skeleton,
   * unlike the four lead columns this page already knows before the
   * request resolves. */
  linkageIds: readonly LinkageId[];
  /** Already known before the request resolves (the page's own current
   * selection) — used only to size the invisible sizer below, never shown. */
  representation: RepresentationId;
}

/** Mirrors `ClusteringMetricsTableBody`'s own region, table shell and lead
 * columns (Enlace, Cofenética, Silueta, Davies–Bouldin), one skeleton row
 * per selected linkage. */
export function ClusteringMetricsTableSkeleton({
  linkageIds,
  representation,
}: ClusteringMetricsTableSkeletonProps) {
  const { t } = useTranslation();

  return (
    <Panel>
      <div className="mb-3">
        <div
          role="region"
          aria-label={t('clustering.metricsTable.regionLabel')}
          tabIndex={0}
          className="overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{t('clustering.metricsTable.caption')}</caption>
            <thead>
              <tr className="border-b border-hairline bg-paper-sunken">
                <th
                  scope="col"
                  className="p-2 text-eyebrow uppercase tracking-wide text-ink-secondary"
                >
                  {t('clustering.metricsTable.linkageHeader')}
                </th>
                <th
                  scope="col"
                  className="p-2 text-eyebrow uppercase tracking-wide text-ink-secondary"
                >
                  {t('clustering.metrics.cophenetic')}
                </th>
                {/* `k_ref` is only known once the response resolves — a
                 * skeleton bar here, never the real header interpolated
                 * with a blank k, which would read as broken text. */}
                <th
                  scope="col"
                  className={cn(
                    'p-2 text-eyebrow uppercase tracking-wide text-ink-secondary',
                    HIGHLIGHT_CLASS_NAME,
                  )}
                >
                  {/* `k_ref` itself is only known once the response
                   * resolves, but the column it will head is already known
                   * — a pending-k label, never an empty `<th>` (axe
                   * `empty-table-header`). */}
                  <span className="sr-only">{t('clustering.metrics.silhouetteAtKPending')}</span>
                  <Skeleton className="h-3 w-24" />
                </th>
                <th
                  scope="col"
                  className={cn(
                    'p-2 text-eyebrow uppercase tracking-wide text-ink-secondary',
                    HIGHLIGHT_CLASS_NAME,
                  )}
                >
                  <span className="sr-only">{t('clustering.metrics.daviesBouldinAtKPending')}</span>
                  <Skeleton className="h-3 w-24" />
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
                    <span className="font-mono text-mono text-ink-secondary">{linkageId}</span>
                  </td>
                  <td className="p-2">
                    <Skeleton className="h-3 w-12" />
                  </td>
                  <td className={cn('p-2', HIGHLIGHT_CLASS_NAME)}>
                    <Skeleton className="h-3 w-12" />
                  </td>
                  <td className={cn('p-2', HIGHLIGHT_CLASS_NAME)}>
                    <Skeleton className="h-3 w-12" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* The real table's own default explanatory line (`ranking`, like
       * `kRef`, is only known once the response resolves) — static text,
       * never response data, so it renders for real immediately instead of
       * being left out of the skeleton entirely.
       *
       * Once the response actually resolves without a cophenetic tie, this
       * exact line disappears and the sample-size caveat below it (never
       * both at once — `ClusteringMetricsTable`'s own rule) is what stays:
       * a longer sentence built from the response's own sample size, whose
       * wrapped height this static fallback alone would then fall short
       * of. An invisible sizer at that same sentence's real length (this
       * page's own already-selected representation, with a placeholder
       * count — never shown, only measured) reserves that real wrap point
       * without inventing a sample size this skeleton does not have. */}
      <div className="relative mt-3">
        <p aria-hidden="true" className="invisible text-body">
          {t('clustering.sampleSizeCaveat', { representation, count: 20 })}
        </p>
        <p className="absolute inset-0 text-body text-ink-secondary">
          {t('clustering.leadersRequireAllLinkages')}
        </p>
      </div>
    </Panel>
  );
}

interface ClusteringMetricsTableBodyProps {
  orderedResults: ClusteringResponse;
  results: ClusteringResponse;
  kRef: number;
  ranking: ClusteringRankingResult | undefined;
  undefinedLabel: string;
}

/** The table itself, split out so the parent only needs a resolved `kRef`
 * to render it — the explanatory text and caveat above stay independent of
 * whether a `kRef` could be resolved at all. */
function ClusteringMetricsTableBody({
  orderedResults,
  results,
  kRef,
  ranking,
  undefinedLabel,
}: ClusteringMetricsTableBodyProps) {
  const { t } = useTranslation();
  const secondaryKs = secondaryFixedKColumns(results, kRef);

  return (
    <div className="mb-3">
      <div
        role="region"
        aria-label={t('clustering.metricsTable.regionLabel')}
        tabIndex={0}
        className="overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{t('clustering.metricsTable.caption')}</caption>
          <thead>
            <tr className="border-b border-hairline bg-paper-sunken">
              <th
                scope="col"
                className="p-2 text-eyebrow uppercase tracking-wide text-ink-secondary"
              >
                {t('clustering.metricsTable.linkageHeader')}
              </th>
              <th
                scope="col"
                className="p-2 text-eyebrow uppercase tracking-wide text-ink-secondary"
              >
                {t('clustering.metrics.cophenetic')}
              </th>
              <th
                scope="col"
                className={cn(
                  'p-2 text-eyebrow uppercase tracking-wide text-ink-secondary',
                  HIGHLIGHT_CLASS_NAME,
                )}
              >
                {t('clustering.metrics.silhouetteAtK', { k: kRef })}
              </th>
              <th
                scope="col"
                className={cn(
                  'p-2 text-eyebrow uppercase tracking-wide text-ink-secondary',
                  HIGHLIGHT_CLASS_NAME,
                )}
              >
                {t('clustering.metrics.daviesBouldinAtK', { k: kRef })}
              </th>
              {secondaryKs.map((k) => (
                <Fragment key={`k-header-${k}`}>
                  <th
                    scope="col"
                    className="border-l border-hairline p-2 text-eyebrow uppercase tracking-wide text-ink-secondary"
                  >
                    {t('clustering.metrics.silhouetteAtK', { k })}
                  </th>
                  <th
                    scope="col"
                    className="p-2 text-eyebrow uppercase tracking-wide text-ink-secondary"
                  >
                    {t('clustering.metrics.daviesBouldinAtK', { k })}
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedResults.map((result) => {
              const isTreeLeader = ranking?.bestTreeFidelity === result.linkageId;
              const isPartitionLeader =
                ranking?.leadersDiffer && ranking.bestPartitionAtKRef === result.linkageId;
              const eyebrow = isTreeLeader
                ? ranking?.leadersDiffer
                  ? t('clustering.leaderTree')
                  : t('clustering.leader')
                : isPartitionLeader
                  ? t('clustering.leaderPartition')
                  : undefined;
              const kRefKey = String(kRef);

              return (
                <tr
                  key={result.linkageId}
                  data-testid={`metrics-row-${result.linkageId}`}
                  className="border-b border-hairline"
                >
                  <td className="p-2">
                    <div className="flex flex-col">
                      {eyebrow && (
                        <span className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
                          {eyebrow}
                        </span>
                      )}
                      <span className="font-mono text-mono text-ink">
                        {result.linkageDisplayName}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 font-mono text-mono text-ink">
                    {formatMetricValue(result.evaluation.cophenetic)}
                  </td>
                  <td className={cn('p-2 font-mono text-mono text-ink', HIGHLIGHT_CLASS_NAME)}>
                    {silhouetteCellText(result.evaluation.meanSilhouette[kRefKey], undefinedLabel)}
                  </td>
                  <td className={cn('p-2 font-mono text-mono text-ink', HIGHLIGHT_CLASS_NAME)}>
                    {daviesBouldinCellText(
                      result.evaluation.daviesBouldin[kRefKey],
                      undefinedLabel,
                    )}
                  </td>
                  {secondaryKs.map((k) => {
                    const key = String(k);
                    return (
                      <Fragment key={`k-${result.linkageId}-${k}`}>
                        <td className="border-l border-hairline p-2 font-mono text-mono text-ink">
                          {silhouetteCellText(
                            result.evaluation.meanSilhouette[key],
                            undefinedLabel,
                          )}
                        </td>
                        <td className="p-2 font-mono text-mono text-ink">
                          {daviesBouldinCellText(
                            result.evaluation.daviesBouldin[key],
                            undefinedLabel,
                          )}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
