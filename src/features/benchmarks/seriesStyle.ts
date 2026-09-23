/**
 * Grayscale-first series styling (DESIGN.md §7.5 "grayscale by default"):
 * SVG `strokeDasharray` values and marker shapes cycle through a fixed set
 * so two series in the same chart are always distinguishable without color
 * (DESIGN.md §7.6 "color is not the only channel").
 */
const DASH_PATTERNS = ['', '6 3', '2 2', '8 3 2 3'] as const;

export type MarkerShape = 'circle' | 'square' | 'diamond' | 'triangle';
const MARKER_SHAPES: readonly MarkerShape[] = ['circle', 'square', 'diamond', 'triangle'];

/**
 * `%` in JavaScript is a remainder, not a mathematical modulo: for a
 * negative `index` it returns a negative (or zero) result, which would
 * index these fixed arrays out of bounds and resolve to `undefined` at
 * runtime despite the non-null assertion below. This wraps into `[0, length)`.
 */
function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/** SVG `strokeDasharray` for the series at this index (empty string = solid). */
export function dashPatternForIndex(index: number): string {
  return DASH_PATTERNS[wrapIndex(index, DASH_PATTERNS.length)]!;
}

/** Point marker shape for the series at this index. */
export function markerShapeForIndex(index: number): MarkerShape {
  return MARKER_SHAPES[wrapIndex(index, MARKER_SHAPES.length)]!;
}
