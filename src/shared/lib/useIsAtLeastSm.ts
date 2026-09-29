import { useSyncExternalStore } from 'react';

/** Tailwind's own `sm` breakpoint (640px). */
const SM_MEDIA_QUERY = '(min-width: 640px)';

function subscribe(onStoreChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(SM_MEDIA_QUERY);
  mediaQueryList.addEventListener('change', onStoreChange);
  return () => mediaQueryList.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(SM_MEDIA_QUERY).matches;
}

/** Tracks the `sm` breakpoint as a live boolean, for a control whose
 * orientation (not just its styling) depends on the viewport. */
export function useIsAtLeastSm(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
