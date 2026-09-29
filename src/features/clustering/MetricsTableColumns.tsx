/**
 * Every column of the metrics table holds a fixed width, so a header wraps at
 * the same point whether the body under it holds placeholder blocks or real
 * numbers: with `table-fixed` the column widths come from these `<col>`
 * elements alone and never from the body cells' content. From left to right:
 * linkage, cophenetic (value and bar), silhouette and Davies–Bouldin (value,
 * bar and sparkline), leader.
 */
const COLUMN_CLASS_NAMES = ['w-44', 'w-40', 'w-56', 'w-56', 'w-32'] as const;

export const METRICS_TABLE_CLASS_NAME = 'w-full table-fixed border-collapse text-left';

/** 11 + 10 + 14 + 14 + 8 rem: below this width the table scrolls (loaded) or
 * clips (skeleton) instead of squeezing its columns further. */
export const METRICS_TABLE_MIN_WIDTH = '57rem';

/** The one column layout the loaded metrics table and its skeleton share. */
export function MetricsTableColumns() {
  return (
    <colgroup>
      {COLUMN_CLASS_NAMES.map((className) => (
        <col key={className} className={className} />
      ))}
    </colgroup>
  );
}
