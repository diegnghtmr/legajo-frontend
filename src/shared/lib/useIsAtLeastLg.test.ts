import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { stubMatchMedia } from '../../test/matchMedia';
import { useIsAtLeastLg } from './useIsAtLeastLg';

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
