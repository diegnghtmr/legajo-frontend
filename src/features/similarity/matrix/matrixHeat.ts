/**
 * Absolute bucket thresholds over `normalizedScore`'s contract-fixed [0, 1]
 * range (`SimilarityResultSchema`), unlike `DpMatrix`'s heat, which
 * is relative to that trace's own min/max because a raw DP value has no
 * fixed range. Presentation only — the interface never computes similarity,
 * only buckets the backend's own already-normalized number for a heat fill.
 *
 * `matrix-low`/`matrix-mid-low`/`matrix-mid` use `ink` text (contrast ≥ 6.4:1);
 * `matrix-high` uses `paper` text (17:1) — same cell-contrast
 * rule `DpMatrix` already applies to its own grayscale ladder.
 *
 * The buckets are listed once, lowest first: the cells read their class from
 * this list and the legend draws the very same entries, so the two cannot
 * drift apart.
 */
export const MATRIX_HEAT_BUCKETS = [
  { lowerBound: 0, label: '< 0.25', className: 'bg-matrix-low text-ink' },
  { lowerBound: 0.25, label: '0.25–0.5', className: 'bg-matrix-mid-low text-ink' },
  { lowerBound: 0.5, label: '0.5–0.75', className: 'bg-matrix-mid text-ink' },
  { lowerBound: 0.75, label: '≥ 0.75', className: 'bg-matrix-high text-paper' },
] as const;

export function matrixHeatClassName(normalizedScore: number): string {
  let className: string = MATRIX_HEAT_BUCKETS[0].className;
  for (const bucket of MATRIX_HEAT_BUCKETS) {
    if (normalizedScore >= bucket.lowerBound) {
      className = bucket.className;
    }
  }
  return className;
}
