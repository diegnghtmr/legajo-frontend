/**
 * Landmark id for the similarity workbench's own results region — the
 * center content of `/similarity`, its trace deep link, and
 * `/similarity/matrix`, whichever of the pairwise view, the matrix, or the
 * empty state is currently showing (`SimilarityWorkbenchLayout`). Focusable
 * (`tabIndex={-1}`), the same convention `shellMetrics.ts`'s own
 * `MAIN_CONTENT_ID` uses.
 *
 * At `lg` and above the center already follows the corpus selection with no
 * click (2 selected shows the pair, 3 or more shows the matrix), so the
 * rail's adaptive CTA (`useAdaptiveSelectionCta`) focuses this region there
 * instead of navigating — the keyboard/assistive-technology path onto
 * results that are already on screen.
 */
export const SIMILARITY_RESULTS_REGION_ID = 'similarity-results-region';
