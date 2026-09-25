/**
 * Presentation rule for the dendrogram grid: each card's dendrogram fills
 * the card's own measured width, and its height follows the leaf count —
 * there is no fixed pixel width or height. The exact height curve is this
 * module's own choice — an author decision documented here, the same
 * "derived, not a backend number" reasoning `cutLine.ts` uses for the cut
 * line's own pixel position — never a value the backend computes or
 * returns.
 *
 * A small corpus (few leaves) still gets a readable minimum height instead
 * of collapsing to almost nothing; height then grows linearly per leaf so
 * leaf labels never crowd as the corpus grows, and is clamped at the top so
 * a very large corpus never grows an individual 2×2 grid card unbounded.
 */
const BASE_HEIGHT = 160;
const HEIGHT_PER_LEAF = 18;
const MIN_HEIGHT = 220;
const MAX_HEIGHT = 640;

export function dendrogramCardHeight(leafCount: number): number {
  if (!Number.isInteger(leafCount) || leafCount < 0) {
    throw new RangeError(`leafCount must be a non-negative integer, was ${leafCount}`);
  }

  const height = BASE_HEIGHT + leafCount * HEIGHT_PER_LEAF;
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height));
}
