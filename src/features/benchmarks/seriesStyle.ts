/**
 * Grayscale-first series styling: SVG `strokeDasharray` values and marker
 * shapes cycle through a fixed set so two series in the same chart are
 * always distinguishable without color (color is never the only channel).
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

const HUE_COUNT = 8;

/**
 * The cluster hue (a CSS colour token) of the series at this index: the
 * third, redundant channel next to the dash pattern and the marker shape.
 * A hue identifies a series named in the legend, never a family.
 */
export function hueForIndex(index: number): string {
  return `var(--color-cluster-${wrapIndex(index, HUE_COUNT) + 1})`;
}
