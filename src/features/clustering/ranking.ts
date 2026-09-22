import type { z } from 'zod';

import type { LinkageId, LinkageResultSchema } from '../../infrastructure/schemas/clustering';

/** TRD §6.5 "Regla de ordenación (fijada)": the cophenetic tie set is every
 * linkage whose correlation is within this tolerance of the highest — the
 * comparison is inclusive (`<=`), matching the backend's own
 * `ClusteringRanking.TIE_TOLERANCE` (`backend/domain/.../evaluation/
 * ClusteringRanking.java`). */
export const COPHENETIC_TIE_TOLERANCE = 1e-3;

/** TRD §6.5's fixed declaration order, used as the final, deterministic
 * tie-break for both leaders (NFR-QA-04 / TAC-10). */
export const LINKAGE_DECLARATION_ORDER: readonly LinkageId[] = [
  'single',
  'complete',
  'average',
  'ward',
];

/** One linkage's three metrics read at the fixed reference cut `k_ref`
 * (TRD §6.5). `daviesBouldinAtKRef` is `null` only when the backend itself
 * reports an undefined Davies–Bouldin for that cut (coincident centroids) —
 * never a stand-in for a missing/malformed value, which is guarded against
 * explicitly (see `metricsAtKRef`). */
export interface LinkageMetricsAtKRef {
  linkageId: LinkageId;
  cophenetic: number;
  meanSilhouetteAtKRef: number;
  daviesBouldinAtKRef: number | null;
}

/** The two leaders the interface must always point to (TRD §6.5): the
 * resolved cophenetic winner ("mejor fidelidad del árbol" / tree fidelity)
 * and the plain silhouette leader at `k_ref` ("mejor partición en k_ref" /
 * partition at k_ref). */
export interface ClusteringRankingResult {
  /** Declaration-order sorted; every linkage within `COPHENETIC_TIE_TOLERANCE`
   * of the maximum cophenetic correlation. Always non-empty. */
  copheneticTieSet: readonly LinkageId[];
  bestTreeFidelity: LinkageId;
  bestPartitionAtKRef: LinkageId;
  leadersDiffer: boolean;
}

function declarationOrder(id: LinkageId): number {
  const index = LINKAGE_DECLARATION_ORDER.indexOf(id);
  if (index === -1) {
    throw new RangeError(
      `unknown linkage id "${id}" — TRD §6.4/§6.5 fix exactly single, complete, average, ward`,
    );
  }
  return index;
}

function requireFiniteMetric(value: number, description: string): void {
  // `Number.isFinite` rejects NaN, +/-Infinity and non-numbers alike: a NaN
  // reaching the tolerance comparison or a comparator would otherwise never
  // compare true/false consistently (NaN <= x and NaN > x are both false),
  // letting it silently "lose" a tie-break or silently "pass" a tolerance
  // check instead of failing loudly.
  if (!Number.isFinite(value)) {
    throw new RangeError(`${description} must be a finite number, was ${value}`);
  }
}

function validateMetrics(metrics: readonly LinkageMetricsAtKRef[]): void {
  if (metrics.length !== 4) {
    throw new RangeError(
      `the ranking rule requires exactly the four fixed linkages (TRD §6.4/§6.5), was ${metrics.length}`,
    );
  }

  const seen = new Set<LinkageId>();
  for (const metric of metrics) {
    if (seen.has(metric.linkageId)) {
      throw new RangeError(`duplicate linkage criterion in metrics: ${metric.linkageId}`);
    }
    seen.add(metric.linkageId);

    requireFiniteMetric(metric.cophenetic, `cophenetic for "${metric.linkageId}"`);
    requireFiniteMetric(
      metric.meanSilhouetteAtKRef,
      `meanSilhouetteAtKRef for "${metric.linkageId}"`,
    );
    if (metric.daviesBouldinAtKRef !== null) {
      requireFiniteMetric(
        metric.daviesBouldinAtKRef,
        `daviesBouldinAtKRef for "${metric.linkageId}"`,
      );
    }
  }
}

/**
 * Applies TRD §6.5's fixed ranking rule to exactly the four canonical
 * linkages' metrics at `k_ref`, ported 1:1 from the backend's own
 * `ClusteringRanking.of` (`backend/domain/src/main/java/co/edu/uniquindio/
 * legajo/evaluation/ClusteringRanking.java`) so both implementations agree —
 * every golden case in that class's test suite is mirrored in
 * `ranking.test.ts`. This is presentation over the backend's own already-
 * computed numbers; it never recomputes cophenetic correlation, silhouette
 * or Davies–Bouldin themselves.
 *
 * Two tie-break rules the TRD leaves open (author decisions, same ones the
 * backend documents): an undefined ("null") Davies–Bouldin loses the
 * cophenetic tie-break's second step to any defined, finite value — it
 * carries no evidence of a well-separated partition. And the plain
 * silhouette leader at `k_ref` (computed over all four linkages, not just
 * the cophenetic tie set) falls back to the same declaration order on a
 * silhouette tie, for the same determinism reason.
 */
export function rankClusteringLinkages(
  metrics: readonly LinkageMetricsAtKRef[],
): ClusteringRankingResult {
  validateMetrics(metrics);

  const maxCophenetic = Math.max(...metrics.map((metric) => metric.cophenetic));
  const tieSet = metrics.filter(
    (metric) => maxCophenetic - metric.cophenetic <= COPHENETIC_TIE_TOLERANCE,
  );

  const copheneticTieBreak = (a: LinkageMetricsAtKRef, b: LinkageMetricsAtKRef): number => {
    if (a.meanSilhouetteAtKRef !== b.meanSilhouetteAtKRef) {
      return b.meanSilhouetteAtKRef - a.meanSilhouetteAtKRef;
    }
    const aDb = a.daviesBouldinAtKRef ?? Number.POSITIVE_INFINITY;
    const bDb = b.daviesBouldinAtKRef ?? Number.POSITIVE_INFINITY;
    if (aDb !== bDb) {
      return aDb - bDb;
    }
    return declarationOrder(a.linkageId) - declarationOrder(b.linkageId);
  };
  const bestTreeFidelity = [...tieSet].sort(copheneticTieBreak)[0].linkageId;

  const silhouetteOrder = (a: LinkageMetricsAtKRef, b: LinkageMetricsAtKRef): number => {
    if (a.meanSilhouetteAtKRef !== b.meanSilhouetteAtKRef) {
      return b.meanSilhouetteAtKRef - a.meanSilhouetteAtKRef;
    }
    return declarationOrder(a.linkageId) - declarationOrder(b.linkageId);
  };
  const bestPartitionAtKRef = [...metrics].sort(silhouetteOrder)[0].linkageId;

  return {
    copheneticTieSet: [...tieSet]
      .sort((a, b) => declarationOrder(a.linkageId) - declarationOrder(b.linkageId))
      .map((metric) => metric.linkageId),
    bestTreeFidelity,
    bestPartitionAtKRef,
    leadersDiffer: bestTreeFidelity !== bestPartitionAtKRef,
  };
}

/**
 * `k_ref = min(4, n - 1)` (TRD §6.5), the reference cut used both in the
 * narrative and as the ranking rule's tie-breaker. `verify-corpus` requires
 * `n >= 3` (TRD §6.1) so the fixed-cut set `{2,3,4,5} ∩ [2, n-1]` is never
 * empty and `k_ref >= 2`; this throws rather than returning a `k_ref` the
 * backend could never have actually evaluated.
 */
export function kRefForSampleSize(sampleSize: number): number {
  if (!Number.isInteger(sampleSize) || sampleSize < 3) {
    throw new RangeError(
      `sampleSize must be an integer >= 3 for k_ref to be defined (TRD §6.1/§6.5), was ${sampleSize}`,
    );
  }
  return Math.min(4, sampleSize - 1);
}

type LinkageResultForRanking = Pick<
  z.infer<typeof LinkageResultSchema>,
  'linkageId' | 'evaluation'
>;

/**
 * Reads each linkage's three metrics at the fixed cut `k_ref` out of a
 * `POST /clustering` response. `meanSilhouette`/`daviesBouldin` are keyed by
 * the cut as a string (TRD §6.6); a genuinely **missing** key (as opposed to
 * an explicit `null` in `daviesBouldin`) means `k_ref` was not among the
 * cuts the backend actually returned — a contract violation this function
 * refuses to paper over by guessing a value.
 */
export function metricsAtKRef(
  results: readonly LinkageResultForRanking[],
  kRef: number,
): LinkageMetricsAtKRef[] {
  const key = String(kRef);

  return results.map((result) => {
    if (!Object.hasOwn(result.evaluation.meanSilhouette, key)) {
      throw new RangeError(
        `meanSilhouette has no entry for k_ref=${kRef} on linkage "${result.linkageId}"`,
      );
    }
    if (!Object.hasOwn(result.evaluation.daviesBouldin, key)) {
      throw new RangeError(
        `daviesBouldin has no entry for k_ref=${kRef} on linkage "${result.linkageId}"`,
      );
    }

    return {
      linkageId: result.linkageId,
      cophenetic: result.evaluation.cophenetic,
      meanSilhouetteAtKRef: result.evaluation.meanSilhouette[key],
      daviesBouldinAtKRef: result.evaluation.daviesBouldin[key],
    };
  });
}
