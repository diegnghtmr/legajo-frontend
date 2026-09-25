import { useEffect, useRef, useState } from 'react';

/**
 * Tracks one element's own measured content width via `ResizeObserver`, for
 * a component that must fill a responsive container instead of rendering at
 * a fixed pixel width (the clustering dendrogram grid: each card's own
 * dendrogram fills that card's width, with no fixed pixel width).
 *
 * Returns `initialWidth` until the observer's first callback ever fires.
 * jsdom has no real layout engine, so `src/test/setup.ts` installs a no-op
 * default `ResizeObserver` that never calls back — a component under test
 * with no fake of its own therefore keeps rendering at `initialWidth`,
 * matching every existing fixed-width rendering assumption. A test that
 * needs to observe a real resize installs its own controllable fake via
 * `vi.stubGlobal('ResizeObserver', ...)` instead (see this hook's own test).
 */
export function useElementWidth<T extends HTMLElement>(
  initialWidth: number,
): readonly [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
