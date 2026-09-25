import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { PanelHeader } from '../../shared/components/Panel';
import { ArticleList } from './ArticleList';
import { CompareCta } from './CompareCta';
import { EmbeddingsStatusPanel } from './EmbeddingsStatusPanel';
import { MatrixCta } from './MatrixCta';
import { applyStickyCtaHeight, STICKY_CTA_SCROLL_MARGIN_BOTTOM } from './stickyCta';

/**
 * Corpus / selection screen: a list of abstracts on the
 * left (desktop) or top (narrow) with the sticky compare/matrix CTA bar, and
 * the selected article's full abstract on the right via the nested route
 * (`CorpusDetailPlaceholder` or `CorpusDetail`, rendered through `Outlet`).
 *
 * The CTA bar is `position: sticky` at the bottom of this column (mobile:
 * top list, sticky bottom, since narrow layouts stay `flex-col`) so both
 * actions stay reachable while scrolling a long article list, on desktop
 * and mobile alike: it keeps its own slot in the normal document flow (it
 * never covers content the way a `fixed` bar would), so the list's own
 * bottom padding below is only there to give its last rows room to clear
 * the bar before it un-sticks, not to work around any overlap from the bar
 * itself.
 *
 * That padding, and the `scroll-margin-bottom` this same bar height
 * requires on each row's own focusable elements (`ArticleRow.tsx`), used to
 * be two separately hard-coded `48` (192px) guesses at the bar's tallest
 * state (both CTAs' disabled-reason text showing) — a guess that silently
 * drifts the moment the bar's own content changes (a longer reason string,
 * a text-zoomed viewport, a translation that wraps). A `ResizeObserver`
 * measures the bar's *real* rendered height instead and publishes it as a
 * shared CSS custom property (`stickyCta.ts`) on this section — both the
 * list's padding and every row's `scroll-margin-bottom` read that one
 * property, so they can never drift apart from each other or from the
 * bar's actual size. The page has no dedicated scroll container (this app
 * scrolls via the document root), so `scroll-padding` on any wrapper here
 * would be a no-op; `scroll-margin` must live on the elements that
 * actually receive focus (WCAG 2.4.11).
 */
export function CorpusPage() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const ctaBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const bar = ctaBarRef.current;
    if (!section || !bar) {
      return;
    }

    applyStickyCtaHeight(section, bar.getBoundingClientRect().height);

    const observer = new ResizeObserver((entries) => {
      // `entry.contentRect` is the *content* box (excludes the bar's own
      // `border-t` and `py-3` padding) — reading it here undercut the
      // border-box height the initial measurement above uses, so a
      // `ResizeObserver` firing its always-automatic first callback right
      // after `observe()` (per spec, with no real resize involved) silently
      // shrank the published height by the border + padding, verified as
      // the exact cause of a live boundary-case e2e failure. `borderBoxSize`
      // matches `getBoundingClientRect()` instead; the bounding-rect call is
      // kept only as a fallback for a runtime that omits it.
      const entry = entries[0];
      const measuredHeight =
        entry?.borderBoxSize?.[0]?.blockSize ?? bar.getBoundingClientRect().height;
      applyStickyCtaHeight(section, measuredHeight);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <section ref={sectionRef} className="flex flex-1 flex-col gap-4">
        <PanelHeader eyebrow={t('corpus.eyebrow')} title={t('corpus.title')} />
        <div style={{ paddingBottom: STICKY_CTA_SCROLL_MARGIN_BOTTOM }}>
          <ArticleList />
        </div>
        <div
          ref={ctaBarRef}
          className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-hairline bg-paper py-3"
        >
          <CompareCta />
          <MatrixCta />
        </div>
        <EmbeddingsStatusPanel />
      </section>
      <section className="flex-1">
        <Outlet />
      </section>
    </div>
  );
}
