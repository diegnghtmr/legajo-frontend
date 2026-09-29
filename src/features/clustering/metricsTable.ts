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
 * The cuts the "view at k" selector offers: every fixed cut `k` the
 * response's own evaluation carries (`k_ref` included), ascending.
 *
 * Keys are unioned across every linkage's own `meanSilhouette`, never read
 * from just the first one: one linkage silently missing a fixed cut must
 * never narrow the whole selector out from under the others.
 */
export function fixedKOptions(results: readonly MetricsTableEvaluationSource[]): number[] {
  const keys = new Set<number>();
  for (const result of results) {
    for (const key of Object.keys(result.evaluation.meanSilhouette)) {
      keys.add(Number(key));
    }
  }
  return [...keys].sort((a, b) => a - b);
}
