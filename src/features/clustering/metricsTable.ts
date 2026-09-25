import { LINKAGE_DECLARATION_ORDER } from './ranking';
import type { LinkageId } from '../../infrastructure/schemas/clustering';

/**
 * Sorts a `POST /clustering` response's linkage results into the metrics
 * table's fixed row order — one row per linkage, in the same declaration
 * order `ranking.ts` already uses (single, complete, average, ward) —
 * regardless of the backend's own array order. A linkage id outside the
 * four canonical ones (never expected from the closed `LinkageIdSchema`
 * enum, but this stays total rather than throwing) sorts after every
 * canonical one, in its original relative order — the table still shows
 * every row it is handed, it just never lets an unknown id perturb the
 * fixed four's order.
 */
export function orderLinkagesForMetricsTable<T extends { linkageId: LinkageId }>(
  results: readonly T[],
): T[] {
  const declarationIndex = (id: LinkageId): number => {
    const index = LINKAGE_DECLARATION_ORDER.indexOf(id);
    return index === -1 ? LINKAGE_DECLARATION_ORDER.length : index;
  };
  return [...results].sort((a, b) => declarationIndex(a.linkageId) - declarationIndex(b.linkageId));
}

export interface MetricsTableEvaluationSource {
  evaluation: {
    meanSilhouette: Record<string, number>;
  };
}

/**
 * The metrics table's secondary column group: every fixed cut `k` the
 * response's own evaluation carries, other than `k_ref` — `k_ref` already
 * has its own lead column (Silhouette/Davies–Bouldin at `k_ref`), so
 * repeating it here would only show the same number a second time. Whether
 * a `k_ref` column should also reappear, highlighted, inside this secondary
 * group is left open by the interface's own rules; this module's own,
 * conservative choice is "no" — the lead column already is the highlight.
 *
 * Keys are unioned across every linkage's own `meanSilhouette`, never read
 * from just the first one: one linkage silently missing a fixed cut must
 * never narrow the whole table's columns out from under the others.
 */
export function secondaryFixedKColumns(
  results: readonly MetricsTableEvaluationSource[],
  kRef: number,
): number[] {
  const keys = new Set<number>();
  for (const result of results) {
    for (const key of Object.keys(result.evaluation.meanSilhouette)) {
      keys.add(Number(key));
    }
  }
  keys.delete(kRef);
  return [...keys].sort((a, b) => a - b);
}
