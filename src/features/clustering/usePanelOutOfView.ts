import { useEffect, useState, type RefObject } from 'react';

/** The app shell's top bar height in px (`h-14`); the panel counts as out of
 * view once it has scrolled up under it. */
const TOP_BAR_HEIGHT_PX = 56;

/**
 * Whether the observed element has scrolled up out of view, under the shell's
 * top bar. An element that is below the viewport, or a browser without
 * `IntersectionObserver` (the observer is progressive enhancement), counts as
 * in view.
 */
export function usePanelOutOfView(ref: RefObject<HTMLElement | null>): boolean {
  const [outOfView, setOutOfView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) {
          setOutOfView(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        }
      },
      { rootMargin: `-${TOP_BAR_HEIGHT_PX}px 0px 0px 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return outOfView;
}
