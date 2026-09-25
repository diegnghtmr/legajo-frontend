import { vi } from 'vitest';

/** A controllable stand-in for a single `MediaQueryList`, returned by
 * {@link stubMatchMedia} so a test can simulate a real resize crossing the
 * breakpoint (`fireChange`) instead of only ever asserting a viewport fixed
 * at whatever it started at. */
export interface FakeMediaQueryList extends Omit<MediaQueryList, 'matches'> {
  matches: boolean;
  fireChange(matches: boolean): void;
}

/** A controllable stand-in for `window.matchMedia`, shaped exactly like the
 * one `src/test/setup.ts` installs by default (see that file's own
 * docstring) — every test that needs a narrow ("below `lg`") viewport, or
 * needs to simulate the viewport crossing the breakpoint mid-test, stubs
 * this instead of hand-rolling its own ad hoc fake, so a future change to
 * the shape only needs updating here.
 *
 * Every call to `window.matchMedia(...)` — whatever query string it is
 * given — returns this exact same object (never a fresh one per call), so
 * `useIsAtLeastLg`'s own `getSnapshot` (which re-reads
 * `window.matchMedia(...).matches` on every render, never caching a single
 * `MediaQueryList` reference) always observes the latest value `fireChange`
 * set, the same live object `subscribe` itself attached its change listener
 * to. Call `vi.unstubAllGlobals()` in the test's own `afterEach` to restore
 * the default (wide, static) stub afterwards. */
export function stubMatchMedia(initialMatches: boolean): FakeMediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const list: FakeMediaQueryList = {
    matches: initialMatches,
    media: '(min-width: 1024px)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener as (event: MediaQueryListEvent) => void);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener as (event: MediaQueryListEvent) => void);
    },
    dispatchEvent: () => false,
    fireChange(matches: boolean) {
      list.matches = matches;
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
  };
  vi.stubGlobal('matchMedia', () => list);
  return list;
}

/** Simulates a viewport below the `lg` breakpoint (1024px): every
 * `window.matchMedia('(min-width: 1024px)')` query reports no match, so
 * `useIsAtLeastLg()` reads `false`. Call `vi.unstubAllGlobals()` in the
 * test's own `afterEach` to restore the default (wide) stub afterwards. */
export function stubNarrowViewport(): void {
  stubMatchMedia(false);
}
