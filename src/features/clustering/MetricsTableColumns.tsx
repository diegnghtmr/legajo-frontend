/** The linkage name column and every metric column each hold a fixed width,
 * so a header wraps at the same point whether the body under it holds
 * placeholder bars or real numbers: with `table-fixed` the column widths come
 * from these `<col>` elements alone and never from the body cells' content. */
const LINKAGE_COLUMN_REM = 11;
const METRIC_COLUMN_REM = 7;

/** Cophenetic, plus the silhouette and Davies–Bouldin pair at `k_ref`. */
const LEAD_METRIC_COLUMNS = 3;

export const METRICS_TABLE_CLASS_NAME = 'w-full table-fixed border-collapse text-left';

/** Below this width the table scrolls (loaded) or clips (skeleton) instead of
 * squeezing its columns further. */
export function metricsTableMinWidth(secondaryPairCount: number): string {
  const metricColumns = LEAD_METRIC_COLUMNS + secondaryPairCount * 2;
  return `${LINKAGE_COLUMN_REM + metricColumns * METRIC_COLUMN_REM}rem`;
}

/** The one column layout the loaded metrics table and its skeleton share. */
export function MetricsTableColumns({ secondaryPairCount }: { secondaryPairCount: number }) {
  return (
    <colgroup>
      <col className="w-44" />
      {Array.from({ length: LEAD_METRIC_COLUMNS + secondaryPairCount * 2 }, (_unused, index) => (
        <col key={index} className="w-28" />
      ))}
    </colgroup>
  );
}
