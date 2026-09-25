import { vi } from 'vitest';

/** A controllable stand-in for `window.matchMedia`, shaped exactly like the
 * one `src/test/setup.ts` installs by default (see that file's own
 * docstring) — every test that needs a narrow ("below `lg`") viewport
 * stubs this instead of hand-rolling its own ad hoc fake, so a future
 * change to the shape only needs updating here. */
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', ((query: string): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia);
}

/** Simulates a viewport below the `lg` breakpoint (1024px): every
 * `window.matchMedia('(min-width: 1024px)')` query reports no match, so
 * `useIsAtLeastLg()` reads `false`. Call `vi.unstubAllGlobals()` in the
 * test's own `afterEach` to restore the default (wide) stub afterwards. */
export function stubNarrowViewport(): void {
  stubMatchMedia(false);
}

/** Simulates a viewport at or above the `lg` breakpoint — the same
 * default `src/test/setup.ts` already installs, exposed here only so a
 * test that toggles between widths can restore it explicitly instead of
 * relying on `vi.unstubAllGlobals()` alone. */
export function stubWideViewport(): void {
  stubMatchMedia(true);
}
