/**
 * Formats one already-computed metric value (cophenetic correlation, mean
 * silhouette, or a defined Davies–Bouldin) for the metrics strip. The
 * interface never recomputes these — this only renders the backend's own
 * number, same 4-decimal convention as `similarity/formatters.ts`'s
 * `formatRawValue`. `null` (an undefined Davies–Bouldin) is handled by the
 * caller with its own accessible text, never routed through this function.
 */
export function formatMetricValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}
