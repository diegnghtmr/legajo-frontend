import { expect, test } from '@playwright/test';

import { canonicalizePartition, isProperRefinement } from './partition.js';

/**
 * Unit tests for the pure partition-comparison logic clustering.spec.ts
 * relies on to prove a k-cut actually regrouped the real documents. No
 * browser or backend involved — these run the comparison functions
 * directly, so the comparison's own correctness is proven independently of
 * the e2e flow that consumes it. Written with `@playwright/test`'s
 * `test`/`expect`, not Vitest: `vitest.config.ts` excludes `e2e-fullstack/**`
 * entirely (that suite's TypeScript project has no "dom" lib and is meant
 * to run only through Playwright, e2e-fullstack-in-docker.sh/e2e-in-docker.sh),
 * so a Vitest test file here would never actually run.
 */
test.describe('canonicalizePartition', () => {
  test('normalizes equivalent groupings under different label integers to the same shape', () => {
    expect(canonicalizePartition([0, 0, 1])).toEqual(canonicalizePartition([7, 7, 2]));
  });

  test('treats two groupings with different membership as different shapes', () => {
    expect(canonicalizePartition([0, 0, 1, 1])).not.toEqual(canonicalizePartition([0, 0, 1, 2]));
  });
});

test.describe('isProperRefinement', () => {
  test('accepts a genuine split: every finer group nests inside one coarser group', () => {
    // coarser: {0,1,2} | {3,4}  finer: {0,1} | {2} | {3,4}
    const coarser = [0, 0, 0, 1, 1];
    const finer = [0, 0, 2, 1, 1];
    expect(isProperRefinement(finer, coarser)).toBe(true);
  });

  // Proves why a naive comparison is not enough: a
  // plain inequality compare (`canonicalizePartition(a) !==
  // canonicalizePartition(b)`) can never catch this, because the two
  // arrays below already have a different number of distinct labels (3 vs
  // 2) by construction — the exact situation clustering.spec.ts guarantees
  // for every real k3Partition/k2Partition pair (it polls until each has
  // exactly k distinct labels). `isProperRefinement` is the check that
  // still correctly rejects it: item 1 (in coarser group 0) and item 3 (in
  // coarser group 1) both land in finer group 2, so finer group 2 spans two
  // different coarser groups — not a valid cut of the same tree, which is
  // what a backend that clustered each k independently, rather than cutting
  // one dendrogram, could produce even while returning a different group
  // count.
  test('rejects a same-count-but-not-nested "k=3" result (independently-clustered bug)', () => {
    const coarser = [0, 0, 1, 1]; // k=2: {0,1} | {2,3}
    const brokenFiner = [0, 2, 1, 2]; // 3 distinct labels, but not nested in coarser
    expect(isProperRefinement(brokenFiner, coarser)).toBe(false);
  });

  // What "k=2 and k=3 would produce the same grouping" looks like in the
  // isolated logic: a relabeled COPY of the k=2 grouping presented as a
  // k=3 result. Group counts are equal (2 == 2), so this must be rejected
  // before the nesting check ever runs — proving the check is not fooled by
  // a same-count-and-content pair.
  test('rejects two partitions with the same real grouping, whatever their label ids', () => {
    const coarser = [0, 0, 1, 1];
    const relabeledSameGrouping = [5, 5, 9, 9];
    expect(isProperRefinement(relabeledSameGrouping, coarser)).toBe(false);
  });

  test('rejects a "finer" partition with fewer or equal distinct groups than "coarser"', () => {
    const coarser = [0, 0, 1, 1, 2, 2];
    const notActuallyFiner = [0, 0, 1, 1, 1, 1]; // 2 groups, not more than coarser's 3
    expect(isProperRefinement(notActuallyFiner, coarser)).toBe(false);
  });

  // Covers the defensive length guard (see its own comment in partition.ts):
  // no real caller ever hits this today, but the guard itself should stay
  // proven rather than silently untested.
  test('rejects two partitions of different lengths', () => {
    const coarser = [0, 0, 1, 1];
    const wrongLengthFiner = [0, 1, 2];
    expect(isProperRefinement(wrongLengthFiner, coarser)).toBe(false);
  });
});
