import { useSyncExternalStore } from 'react';

/** Tailwind's own `lg` breakpoint (1024px) — the same width
 * `WorkbenchLayout`'s CSS uses to hide its `detail` slot entirely. */
const LG_MEDIA_QUERY = '(min-width: 1024px)';

function subscribe(onStoreChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(LG_MEDIA_QUERY);
  mediaQueryList.addEventListener('change', onStoreChange);
  return () => mediaQueryList.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(LG_MEDIA_QUERY).matches;
}

/**
 * Tracks that breakpoint as a live boolean, so a `WorkbenchLayout` consumer
 * can decide between the docked/overlay detail region (at and above `lg`)
 * and a full-height sheet (below it) without duplicating the breakpoint's
 * pixel value in its own code, and without leaving it stuck at whatever it
 * was on mount if the viewport is later resized across it.
 *
 * `useSyncExternalStore` (rather than a `useState` seeded once from a lazy
 * initializer, with a separate `useEffect` subscribing afterwards) re-reads
 * `getSnapshot` on every render AND the instant it subscribes, so a change
 * landing in the gap between the initial render and that later effect
 * committing — a real window with concurrent rendering, where React can
 * render, discard, and re-render before ever committing or running an
 * effect — can never leave this hook stuck reporting a stale breakpoint
 * that no longer matches `window.matchMedia`'s own live value.
 */
export function useIsAtLeastLg(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
