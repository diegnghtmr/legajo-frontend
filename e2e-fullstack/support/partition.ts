/**
 * Pure partition-comparison logic used by clustering.spec.ts to prove that
 * applying a k-cut with a different k actually regroups the real documents.
 * Kept separate from the spec file (and covered on its own by
 * partition.spec.ts) so the comparison's correctness can be exercised
 * directly, with no browser or backend, instead of only ever running inside
 * a full e2e flow.
 */

/**
 * Groups item indices by cluster label and normalizes the result so two
 * partitions compare equal exactly when they group the SAME items together,
 * independent of which arbitrary integer label each group happens to carry.
 * The backend's contract only promises `labels: number[]` for a cut (TRD
 * §6.6 `POST /clustering/cut`), never that the values form a contiguous
 * 0..k-1 range, so nothing here — or in any caller — may assume specific
 * label ids.
 */
export function canonicalizePartition(partition: readonly number[]): number[][] {
  const groups = new Map<number, number[]>();
  partition.forEach((label, index) => {
    const group = groups.get(label) ?? [];
    group.push(index);
    groups.set(label, group);
  });
  return [...groups.values()]
    .map((group) => [...group].sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}

/**
 * True when `finer` is a genuine refinement of `coarser`: every group of
 * `finer` sits entirely inside exactly one group of `coarser`, and `finer`
 * has strictly more groups than `coarser`. That is what cutting a SINGLE
 * Ward dendrogram at a larger k must produce — a larger k can only split an
 * existing group further, never move an item across a group boundary that
 * the smaller k already drew.
 *
 * This is the one meaningful check that two cuts at different k values
 * differ in a way that matters. Comparing canonicalized partitions for
 * plain inequality instead is tautological once both partitions are already
 * known to have a different number of distinct groups — any two arrays of
 * different lengths are never deep-equal, regardless of their content — and
 * that is always the case here: the caller only reaches this check after
 * polling until each partition has exactly k distinct labels.
 * `isProperRefinement` checks something inequality cannot: that the extra
 * group in `finer` came from actually splitting one of `coarser`'s groups,
 * not from an unrelated, independently-computed assignment that merely
 * happens to use a different number of labels.
 */
export function isProperRefinement(finer: readonly number[], coarser: readonly number[]): boolean {
  if (finer.length !== coarser.length) {
    return false;
  }
  if (new Set(finer).size <= new Set(coarser).size) {
    return false;
  }
  const coarserGroupOfFinerLabel = new Map<number, number>();
  for (let index = 0; index < finer.length; index += 1) {
    const finerLabel = finer[index];
    const coarserLabel = coarser[index];
    const seenCoarserLabel = coarserGroupOfFinerLabel.get(finerLabel);
    if (seenCoarserLabel === undefined) {
      coarserGroupOfFinerLabel.set(finerLabel, coarserLabel);
    } else if (seenCoarserLabel !== coarserLabel) {
      return false;
    }
  }
  return true;
}
