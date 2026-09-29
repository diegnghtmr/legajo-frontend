/**
 * Presentation rule for the dendrogram grid: each card's dendrogram fills the
 * card's own measured width, and its height follows the leaf count — there is
 * no fixed pixel width or height. A leaf gets 22px of vertical room and the
 * chart adds 60px of chrome (the room above the plot for the cut chip and
 * below it for the distance axis): `(n - 1) x 22 + 60`. It is a derived
 * layout number, the same "derived, not a backend number" reasoning
 * `cutLine.ts` uses for the cut line's own pixel position — never a value the
 * backend computes or returns.
 */
const HEIGHT_PER_LEAF = 22;
const CHROME_HEIGHT = 60;

export function dendrogramCardHeight(leafCount: number): number {
  if (!Number.isInteger(leafCount) || leafCount < 0) {
    throw new RangeError(`leafCount must be a non-negative integer, was ${leafCount}`);
  }

  return Math.max(0, leafCount - 1) * HEIGHT_PER_LEAF + CHROME_HEIGHT;
}
