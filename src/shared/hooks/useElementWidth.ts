import { useState } from 'react';

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
 *
 * Returns a **callback ref**, not a `RefObject`: an effect keyed on `[]`
 * only ever runs once, at the initial commit, so it can only ever observe
 * whichever node (if any) is already attached at that moment. A node that
 * attaches later — a conditional render that mounts its measured element
 * only once a request settles — would then never be observed, and a ref
 * that moves from one host node to another (a remount behind the same
 * `ref` prop) would leave the old node's observer dangling instead of
 * disconnecting it. A callback ref fires on every attach and detach, so it
 * disconnects the previous observer (if any) and observes whichever node is
 * now attached, every time.
 */
export function useElementWidth<T extends HTMLElement>(
  initialWidth: number,
): readonly [(node: T | null) => void, number] {
  const [width, setWidth] = useState(initialWidth);
  // `useState`'s lazy initializer runs exactly once, on this hook's first
  // render, giving a callback ref with a stable identity for the
  // component's whole lifetime — without reading or writing a ref's
  // `.current` during render, which this project's lint rule
  // (`react-hooks/refs`) forbids. `currentObserver` lives in this closure,
  // not in React state: it is imperative bookkeeping for whichever
  // `ResizeObserver` is currently attached, never something a render needs
  // to react to.
  const [setRef] = useState<(node: T | null) => void>(() => {
    let currentObserver: ResizeObserver | null = null;
    return (node: T | null) => {
      currentObserver?.disconnect();
      currentObserver = null;

      if (!node) {
        return;
      }

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      currentObserver = observer;
    };
  });

  return [setRef, width] as const;
}
