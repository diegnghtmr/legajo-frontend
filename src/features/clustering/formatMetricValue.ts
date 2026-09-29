/**
 * Formats one already-computed metric value (cophenetic correlation, mean
 * silhouette, or a defined Davies–Bouldin) for the metrics table: always
 * three decimals, so a column reads at a glance. The interface never
 * recomputes these — this only renders the backend's own number. `null` (an
 * undefined Davies–Bouldin) is handled by the caller with its own accessible
 * text, never routed through this function.
 */
export function formatMetricValue(value: number): string {
  return value.toFixed(3);
}
