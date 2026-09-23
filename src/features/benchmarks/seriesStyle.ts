/**
 * Grayscale-first series styling (DESIGN.md §7.5 "grayscale by default"):
 * SVG `strokeDasharray` values and marker shapes cycle through a fixed set
 * so two series in the same chart are always distinguishable without color
 * (DESIGN.md §7.6 "color is not the only channel").
 */
const DASH_PATTERNS = ['', '6 3', '2 2', '8 3 2 3'] as const;

export type MarkerShape = 'circle' | 'square' | 'diamond' | 'triangle';
const MARKER_SHAPES: readonly MarkerShape[] = ['circle', 'square', 'diamond', 'triangle'];

/** SVG `strokeDasharray` for the series at this index (empty string = solid). */
export function dashPatternForIndex(index: number): string {
  return DASH_PATTERNS[index % DASH_PATTERNS.length]!;
}

/** Point marker shape for the series at this index. */
export function markerShapeForIndex(index: number): MarkerShape {
  return MARKER_SHAPES[index % MARKER_SHAPES.length]!;
}
