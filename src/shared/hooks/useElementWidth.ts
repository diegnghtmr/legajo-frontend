import { useState } from 'react';

/** Horizontal padding and border of `node`: `getBoundingClientRect` includes
 * both, while a `ResizeObserver` content rect (and so a chart drawn inside
 * the node) does not. */
function horizontalInset(node: HTMLElement): number {
  const style = getComputedStyle(node);
  return [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]
    .map((value) => Number.parseFloat(value) || 0)
    .reduce((sum, value) => sum + value, 0);
}

/** The node's current content width, read from layout right now; `null`
 * while it has none (not laid out, or `display: none`). */
function measureContentWidth(node: HTMLElement): number | null {
  const width = node.getBoundingClientRect().width - horizontalInset(node);
  return width > 0 ? width : null;
}

/**
 * Tracks one element's own content width, for a component that must fill a
 * responsive container instead of rendering at a fixed pixel width (the
 * benchmark charts and the clustering dendrogram grid).
 *
 * The width is `null` until it is really known, and a caller renders its
 * box at the final height with nothing drawn in it until then. The width is
 * read synchronously the moment the element attaches, which happens during
 * the commit and before the browser paints, so React re-renders with the
 * measured width before the first frame: a chart is never painted at a
 * guessed width and then resized. A `ResizeObserver` then follows every
 * later change. jsdom has no layout engine, so under test the width stays
 * `null` until a test makes the element report one (spying on
 * `getBoundingClientRect`) or installs a controllable observer fake via
 * `vi.stubGlobal('ResizeObserver', ...)`; `src/test/setup.ts` documents the
 * default no-op observer.
 *
 * Returns a **callback ref**, not a `RefObject`: an effect keyed on `[]`
 * only ever runs once, at the initial commit, so it can only ever observe
 * whichever node (if any) is already attached at that moment. A node that
 * attaches later — a conditional render that mounts its measured element
 * only once a request settles — would then never be observed, and a ref
 * that moves from one host node to another (a remount behind the same
 * `ref` prop) would leave the old node's observer dangling instead of
 * disconnecting it. A callback ref fires on every attach and detach, so it
 * disconnects the previous observer (if any), measures, and observes
 * whichever node is now attached, every time.
 */
export function useElementWidth<T extends HTMLElement>(): readonly [
  (node: T | null) => void,
  number | null,
] {
  const [width, setWidth] = useState<number | null>(null);
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

      setWidth(measureContentWidth(node));

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setWidth(entry.contentRect.width > 0 ? entry.contentRect.width : null);
        }
      });
      observer.observe(node);
      currentObserver = observer;
    };
  });

  return [setRef, width] as const;
}
