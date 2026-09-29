import { afterEach, describe, expect, it, vi } from 'vitest';

import { readMotionDurationMs } from './motionDuration';

function stubRootVariable(value: string) {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: () => value,
  } as unknown as CSSStyleDeclaration);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readMotionDurationMs', () => {
  it('reads a millisecond duration token from the root', () => {
    stubRootVariable(' 600ms');

    expect(readMotionDurationMs('--dur-chart')).toBe(600);
  });

  it('reads the zero the reduced-motion block sets', () => {
    stubRootVariable('0ms');

    expect(readMotionDurationMs('--dur-chart')).toBe(0);
  });

  it('is zero, so nothing animates, when the token is missing or unreadable', () => {
    stubRootVariable('');
    expect(readMotionDurationMs('--dur-chart')).toBe(0);

    stubRootVariable('soon');
    expect(readMotionDurationMs('--dur-chart')).toBe(0);
  });
});
