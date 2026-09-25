import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIsAtLeastLg } from './useIsAtLeastLg';

interface FakeMediaQueryList extends Omit<MediaQueryList, 'matches'> {
  matches: boolean;
  fireChange(matches: boolean): void;
}

function stubMatchMedia(initialMatches: boolean): FakeMediaQueryList {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useIsAtLeastLg', () => {
  it('reads the initial match state from matchMedia', () => {
    stubMatchMedia(false);

    const { result } = renderHook(() => useIsAtLeastLg());

    expect(result.current).toBe(false);
  });

  it('defaults to the wide-viewport state the shared test stub reports', () => {
    const { result } = renderHook(() => useIsAtLeastLg());

    expect(result.current).toBe(true);
  });

  it('updates when the media query list reports a change, e.g. a resize across the breakpoint', () => {
    const list = stubMatchMedia(true);

    const { result } = renderHook(() => useIsAtLeastLg());
    expect(result.current).toBe(true);

    act(() => {
      list.fireChange(false);
    });

    expect(result.current).toBe(false);
  });
});
