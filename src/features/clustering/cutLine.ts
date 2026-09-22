/**
 * Thrown for a `k` outside the contract's own bound (TRD §6.6: `k` integer
 * in `[2, n-1]`) — the same range the cut form validates before ever
 * submitting, kept here too since this function is also usable on its own.
 */
export class CutLineError extends Error {}

/**
 * Presentation rule for the dashed cut line (DESIGN.md §6 item 4 says only
 * "cut line dashed `warning`, always drawn when a cut is requested" — the
 * exact height is this task's own choice, documented here): the line sits
 * midway between the `(n-k)`-th and `(n-k+1)`-th merge distances in
 * ascending order. Cutting after the first `n-k` merges (in increasing
 * distance order) leaves exactly `k` clusters, so the line separates the
 * last merge kept from the first merge undone — never a computed cut
 * itself, only a pixel position derived from the backend's own distances.
 *
 * Rows normally already arrive non-decreasing (TRD §6.4), but this sorts
 * defensively rather than assuming that invariant holds.
 */
export function computeCutDistance(rows: readonly { mergeDistance: number }[], k: number): number {
  const n = rows.length + 1;

  if (!Number.isInteger(k) || k < 2 || k > n - 1) {
    throw new CutLineError(`k must be an integer in [2, ${n - 1}] for n = ${n}; got ${k}.`);
  }

  const distances = [...rows.map((row) => row.mergeDistance)].sort((a, b) => a - b);
  const belowIndex = n - k - 1;
  const aboveIndex = n - k;

  return (distances[belowIndex] + distances[aboveIndex]) / 2;
}

/**
 * Same rule as `computeCutDistance`, but resolves to `undefined` instead of
 * throwing. Meant for render time, where a successful cut's `k` (the
 * backend's own answer to `POST /clustering/cut`) is checked again against
 * whichever rows are currently loaded for that linkage — if the two ever
 * disagree (a stale/malformed response, or `k` outside the rows' own bound),
 * the page degrades to "no cut line" instead of turning a successful cut
 * into a rendering error.
 */
export function tryComputeCutDistance(
  rows: readonly { mergeDistance: number }[],
  k: number,
): number | undefined {
  try {
    return computeCutDistance(rows, k);
  } catch (error) {
    if (error instanceof CutLineError) {
      return undefined;
    }
    throw error;
  }
}
