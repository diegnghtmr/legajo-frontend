import { describe, expect, it } from 'vitest';

import { logDecadeTicks } from './logDecadeTicks';

describe('logDecadeTicks', () => {
  it('spans the full decade range from the smallest to the largest positive value', () => {
    expect(logDecadeTicks([12, 340, 5000])).toEqual([10, 100, 1000, 10000]);
  });

  it('returns a single tick when every value already falls in the same decade', () => {
    expect(logDecadeTicks([15, 42, 88])).toEqual([10, 100]);
  });

  it('lands exactly on the boundary decades for values that are already exact powers of ten', () => {
    expect(logDecadeTicks([100, 1000])).toEqual([100, 1000]);
  });

  it('ignores zero and negative values — a log scale has no representation for either', () => {
    expect(logDecadeTicks([0, -5, 200])).toEqual([100, 1000]);
  });

  it('ignores non-finite values (NaN, Infinity)', () => {
    expect(logDecadeTicks([Number.NaN, Number.POSITIVE_INFINITY, 200])).toEqual([100, 1000]);
  });

  it('returns an empty array when there is no positive value at all', () => {
    expect(logDecadeTicks([])).toEqual([]);
    expect(logDecadeTicks([0, -1])).toEqual([]);
  });

  it('handles a single positive value', () => {
    expect(logDecadeTicks([250])).toEqual([100, 1000]);
  });
});
