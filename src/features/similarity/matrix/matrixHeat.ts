/**
 * Absolute bucket thresholds over `normalizedScore`'s contract-fixed [0, 1]
 * range (`SimilarityResultSchema`), unlike `DpMatrix`'s heat, which
 * is relative to that trace's own min/max because a raw DP value has no
 * fixed range. Presentation only — the interface never computes similarity,
 * only buckets the backend's own already-normalized number for a heat fill.
 */
const MATRIX_HEAT_THRESHOLDS = {
  high: 0.75,
  mid: 0.5,
  midLow: 0.25,
} as const;

/**
 * `matrix-low`/`matrix-mid-low`/`matrix-mid` use `ink` text (contrast ≥ 6.4:1);
 * `matrix-high` uses `paper` text (17:1) — same cell-contrast
 * rule `DpMatrix` already applies to its own grayscale ladder.
 */
export function matrixHeatClassName(normalizedScore: number): string {
  if (normalizedScore >= MATRIX_HEAT_THRESHOLDS.high) {
    return 'bg-matrix-high text-paper';
  }
  if (normalizedScore >= MATRIX_HEAT_THRESHOLDS.mid) {
    return 'bg-matrix-mid text-ink';
  }
  if (normalizedScore >= MATRIX_HEAT_THRESHOLDS.midLow) {
    return 'bg-matrix-mid-low text-ink';
  }
  return 'bg-matrix-low text-ink';
}
