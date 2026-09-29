import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Horizontal box of a link inside its positioned container, in px. */
export interface LinkBox {
  x: number;
  width: number;
}

/**
 * Measures the `aria-current="page"` link inside `containerRef`, for an
 * indicator that slides behind the current item. The container must be
 * positioned (`offsetParent`). Measured in a layout effect, so the indicator
 * is already in place on the first paint of a new route, and again whenever
 * `remeasureKey` changes (route, language, breakpoint) or the container
 * itself resizes (font loading, a wrapped label). Returns `null` when no
 * link is current.
 */
export function useActiveLinkBox(
  containerRef: RefObject<HTMLElement | null>,
  remeasureKey: string,
): LinkBox | null {
  const [box, setBox] = useState<LinkBox | null>(null);

  const measure = useCallback(() => {
    const link = containerRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
    const next = link ? { x: link.offsetLeft, width: link.offsetWidth } : null;
    setBox((previous) =>
      previous?.x === next?.x && previous?.width === next?.width ? previous : next,
    );
  }, [containerRef]);

  useLayoutEffect(() => {
    measure();
  }, [measure, remeasureKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let active = true;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    // Web fonts change every label's width once they arrive.
    void document.fonts?.ready.then(() => {
      if (active) {
        measure();
      }
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [containerRef, measure]);

  return box;
}
