import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import type { ClusteringResponse } from '../../infrastructure/api/clustering';
import type { LinkageId, RepresentationId } from '../../infrastructure/schemas/clustering';
import { Panel } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { cn } from '../../shared/lib/cn';
import { formatMetricValue } from './formatMetricValue';
import { orderLinkagesForMetricsTable, secondaryFixedKColumns } from './metricsTable';
import { kRefForSampleSize, type ClusteringRankingResult } from './ranking';

/** `kRefForSampleSize`'s own fixed-cut set (`{2,3,4,5} ∩ [2, n-1]`) —
 * mirrored here only to lay out the skeleton's own secondary column group
 * (see `estimatedSecondaryColumnKs` below), never to compute a real
 * value. */
const FIXED_CUTS = [2, 3, 4, 5];

/** The real per-linkage display names, captured against the reference
 * corpus (the same mapping `CutFormSkeleton` reserves its own segmented
 * control width from) — used only to size this column's own invisible
 * sizer below. The bare mono id is markedly shorter ("complete" vs
 * "Complete linkage"), and at some viewport widths the real, longer name
 * wraps onto a second line inside this column while the id alone never
 * would — under-reserving this row's own real height exactly where a
 * leader's own eyebrow line does not already cover the difference. */
const TYPICAL_LINKAGE_DISPLAY_NAME: Record<string, string> = {
  single: 'Single linkage',
  complete: 'Complete linkage',
  average: 'Average linkage',
  ward: 'Ward linkage',
};

/**
 * The secondary (non-`k_ref`) fixed cuts the metrics table is likely to
 * show, from a sample-size estimate alone: every fixed cut in
 * `kRefForSampleSize`'s own set that both fits the estimated sample size
 * and is not `k_ref` itself. The real set instead comes from whichever
 * fixed cuts the response's own linkages actually carry
 * (`secondaryFixedKColumns`) — an already-malformed or degenerate response
 * can legitimately carry fewer, so this is a sizing aid for the common,
 * well-formed case, never a substitute for that real set. Used to count the
 * secondary column pairs and to label each of their headers.
 */
function estimatedSecondaryColumnKs(sampleSizeEstimate: number): number[] {
  if (!Number.isInteger(sampleSizeEstimate) || sampleSizeEstimate < 3) {
    return [];
  }
  const kRef = kRefForSampleSize(sampleSizeEstimate);
  return FIXED_CUTS.filter((k) => k <= sampleSizeEstimate - 1 && k !== kRef);
}

/** `kRefForSampleSize`'s own estimated value, or `undefined` below its own
 * valid domain — used to label the lead column pair. */
function estimatedKRef(sampleSizeEstimate: number): number | undefined {
  return Number.isInteger(sampleSizeEstimate) && sampleSizeEstimate >= 3
    ? kRefForSampleSize(sampleSizeEstimate)
    : undefined;
}

/** One metrics-table header cell of the skeleton: the real header text, k
 * included, from the sample-size estimate. The labels are known before the
 * response, and a plain text node directly in the `<th>` wraps exactly like
 * the loaded header does. Only when no `k_ref` can be estimated does it fall
 * back to the "k pending" wording. */
function MetricHeaderCell({
  pendingLabel,
  realLabelKey,
  k,
  className,
}: {
  pendingLabel: string;
  realLabelKey: 'clustering.metrics.silhouetteAtK' | 'clustering.metrics.daviesBouldinAtK';
  k: number | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <th scope="col" className={className}>
      {k === undefined ? pendingLabel : t(realLabelKey, { k })}
    </th>
  );
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

/** Mirrors `ClusteringMetricsTableBody`'s own region, table shell and lead
 * columns (Enlace, Cofenética, Silueta, Davies–Bouldin), one skeleton row
 * per selected linkage. */
export function ClusteringMetricsTableSkeleton({
  linkageIds,
  representation,
  sampleSizeEstimate,
}: ClusteringMetricsTableSkeletonProps) {
  const { t } = useTranslation();
  const secondaryKs = estimatedSecondaryColumnKs(sampleSizeEstimate);
  const kRefEstimate = estimatedKRef(sampleSizeEstimate);
  const silhouettePendingLabel = t('clustering.metrics.silhouetteAtKPending');
  const daviesBouldinPendingLabel = t('clustering.metrics.daviesBouldinAtKPending');

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
                {/* `k_ref` comes from the sample-size estimate (the corpus
                 * size, which is what the response will report), so the
                 * header reads exactly as the loaded one does. */}
                <MetricHeaderCell
                  pendingLabel={silhouettePendingLabel}
                  realLabelKey="clustering.metrics.silhouetteAtK"
                  k={kRefEstimate}
                  className={cn(
                    'p-2 text-eyebrow uppercase tracking-wide text-ink-secondary',
                    HIGHLIGHT_CLASS_NAME,
                  )}
                />
                <MetricHeaderCell
                  pendingLabel={daviesBouldinPendingLabel}
                  realLabelKey="clustering.metrics.daviesBouldinAtK"
                  k={kRefEstimate}
                  className={cn(
                    'p-2 text-eyebrow uppercase tracking-wide text-ink-secondary',
                    HIGHLIGHT_CLASS_NAME,
                  )}
                />
                {/* The secondary (non-`k_ref`) column group: its own real
                 * count depends on the response, but a sample-size
                 * estimate already fixes it for the common case (see
                 * `estimatedSecondaryColumnKs`) — reserving that many pairs
                 * now, rather than none, is what keeps this header row
                 * from wrapping any further than the real one (mostly)
                 * does. */}
                {secondaryKs.map((k, index) => (
                  <Fragment key={k}>
                    <MetricHeaderCell
                      pendingLabel={silhouettePendingLabel}
                      realLabelKey="clustering.metrics.silhouetteAtK"
                      k={k}
                      className={cn(
                        'p-2 text-eyebrow uppercase tracking-wide text-ink-secondary',
                        index === 0 && 'border-l border-hairline',
                      )}
                    />
                    <MetricHeaderCell
                      pendingLabel={daviesBouldinPendingLabel}
                      realLabelKey="clustering.metrics.daviesBouldinAtK"
                      k={k}
                      className="p-2 text-eyebrow uppercase tracking-wide text-ink-secondary"
                    />
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {linkageIds.map((linkageId, rowIndex) => (
                <tr
                  key={linkageId}
                  data-testid={`metrics-row-skeleton-${linkageId}`}
                  className="border-b border-hairline"
                >
                  <td className="p-2">
                    <div className="flex flex-col">
                      {/* Exactly which linkage(s) the response actually
                       * marks a leader is response-dependent (the
                       * cophenetic/silhouette winners), but a well-formed
                       * response almost always marks either one (a tied
                       * cophenetic and silhouette leader) or two (a tree
                       * leader and a different partition leader) of these
                       * four rows — never zero, never more than two.
                       * Reserving this eyebrow line on exactly two of the
                       * four rows (position never matters: the table's
                       * own total height is this column's per-row heights
                       * summed, so which two carries no effect on it)
                       * reproduces that typical total exactly; the only
                       * residual left is the less common one-leader case
                       * (a single extra eyebrow line's own height). */}
                      {rowIndex < 2 && (
                        <span
                          aria-hidden="true"
                          className="invisible text-eyebrow font-semibold uppercase tracking-wide"
                        >
                          {t('clustering.leaderPartition')}
                        </span>
                      )}
                      {/* `relative`/invisible-sizer, not the bare id alone:
                       * the real cell's own name line shows the response's
                       * `linkageDisplayName` ("Complete linkage"), not the
                       * shorter mono id, and at some widths the real name
                       * wraps onto a second line inside this column while
                       * the id alone never would. The id itself stays the
                       * visible text — it is still the one thing already
                       * known here — this only reserves the real name's
                       * own typical wrapped height underneath it. */}
                      <span className="relative block font-mono text-mono text-ink-secondary">
                        <span aria-hidden="true" className="invisible">
                          {TYPICAL_LINKAGE_DISPLAY_NAME[linkageId] ?? linkageId}
                        </span>
                        <span className="absolute inset-0">{linkageId}</span>
                      </span>
                    </div>
                  </td>
                  <td className="p-2">
                    <Skeleton className="h-[18px] w-12" />
                  </td>
                  <td className={cn('p-2', HIGHLIGHT_CLASS_NAME)}>
                    <Skeleton className="h-[18px] w-12" />
                  </td>
                  <td className={cn('p-2', HIGHLIGHT_CLASS_NAME)}>
                    <Skeleton className="h-[18px] w-12" />
                  </td>
                  {secondaryKs.map((k, index) => (
                    <Fragment key={k}>
                      <td className={cn('p-2', index === 0 && 'border-l border-hairline')}>
                        <Skeleton className="h-[18px] w-12" />
                      </td>
                      <td className="p-2">
                        <Skeleton className="h-[18px] w-12" />
                      </td>
                    </Fragment>
                  ))}
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
       * of. An invisible sizer built from that same sentence — this page's
       * own already-selected representation, plus `sampleSizeEstimate`
       * (the caller's own already-known corpus size; see this prop's own
       * doc comment) — reserves that real wrap point exactly whenever that
       * estimate is the real count, which it always is once the corpus
       * list has resolved. */}
      <div className="relative mt-3">
        <p aria-hidden="true" className="invisible text-body">
          {t('clustering.sampleSizeCaveat', { representation, count: sampleSizeEstimate })}
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
