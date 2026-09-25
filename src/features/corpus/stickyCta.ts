/**
 * Shared contract between `CorpusPage` (measures the sticky compare/matrix
 * CTA bar and publishes its height) and `ArticleRow` (reads it back for
 * `scroll-margin-bottom`, WCAG 2.4.11): a CSS custom property on their
 * common ancestor, instead of the two files agreeing on a hard-coded pixel
 * value that silently drifts whenever the bar's own content changes (a
 * longer disabled-reason string, a text-zoomed viewport, a translation that
 * wraps).
 */
export const STICKY_CTA_HEIGHT_VAR = '--corpus-cta-height';

/**
 * The bar's own previously-measured tallest state (both CTAs' disabled
 * reason text showing), kept as the `var()` fallback so layout stays
 * correct before the first `ResizeObserver` callback fires (or if it never
 * fires at all, e.g. a jsdom test that stubs it out as a no-op).
 */
const STICKY_CTA_HEIGHT_FALLBACK_PX = 192;

/** Small breathing room between a focused/visible row and the bar above it. */
const STICKY_CTA_GAP_PX = 16;

/**
 * Used for both the list's own bottom padding (room for its last rows to
 * clear the bar before it un-sticks) and each row's own `scroll-margin-bottom`
 * (so a native focus scroll never leaves a row hidden behind the bar) — the
 * same value, so the two stay in sync by construction instead of by two
 * separately maintained constants.
 */
export const STICKY_CTA_SCROLL_MARGIN_BOTTOM = `calc(var(${STICKY_CTA_HEIGHT_VAR}, ${STICKY_CTA_HEIGHT_FALLBACK_PX}px) + ${STICKY_CTA_GAP_PX}px)`;

/** Publishes the bar's freshly measured height onto its (and the rows') common ancestor. */
export function applyStickyCtaHeight(target: HTMLElement, heightPx: number): void {
  target.style.setProperty(STICKY_CTA_HEIGHT_VAR, `${heightPx}px`);
}
