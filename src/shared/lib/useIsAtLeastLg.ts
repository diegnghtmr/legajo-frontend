import { useEffect, useState } from 'react';

/** Tailwind's own `lg` breakpoint (1024px) — the same width
 * `WorkbenchLayout`'s CSS uses to hide its `detail` slot entirely. */
const LG_MEDIA_QUERY = '(min-width: 1024px)';

/**
 * Tracks that breakpoint as a live boolean, so a `WorkbenchLayout` consumer
 * can decide between the docked/overlay detail region (at and above `lg`)
 * and a full-height sheet (below it) without duplicating the breakpoint's
 * pixel value in its own code, and without leaving it stuck at whatever it
 * was on mount if the viewport is later resized across it.
 */
export function useIsAtLeastLg(): boolean {
  const [isAtLeastLg, setIsAtLeastLg] = useState(() => window.matchMedia(LG_MEDIA_QUERY).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(LG_MEDIA_QUERY);

    function handleChange(event: MediaQueryListEvent) {
      setIsAtLeastLg(event.matches);
    }

    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  return isAtLeastLg;
}
