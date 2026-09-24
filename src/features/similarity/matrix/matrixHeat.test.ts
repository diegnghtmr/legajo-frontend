import { describe, expect, it } from 'vitest';

import { matrixHeatClassName } from './matrixHeat';

/**
 * Boundary-exact bucket assertions: 0, just below/at each
 * threshold, and 1. Unlike `DpMatrix`'s relative min/max heat (raw DP values
 * have no fixed range), `normalizedScore` is already contract-guaranteed to
 * [0, 1] (`SimilarityResultSchema`), so the buckets are absolute
 * thresholds over that fixed range, not min/max-relative.
 */
describe('matrixHeatClassName', () => {
  it('buckets 0 as matrix-low', () => {
    expect(matrixHeatClassName(0)).toBe('bg-matrix-low text-ink');
  });

  it('buckets just below the mid-low threshold (0.2499) as matrix-low', () => {
    expect(matrixHeatClassName(0.2499)).toBe('bg-matrix-low text-ink');
  });

  it('buckets exactly at the mid-low threshold (0.25) as matrix-mid-low', () => {
    expect(matrixHeatClassName(0.25)).toBe('bg-matrix-mid-low text-ink');
  });

  it('buckets just below the mid threshold (0.4999) as matrix-mid-low', () => {
    expect(matrixHeatClassName(0.4999)).toBe('bg-matrix-mid-low text-ink');
  });

  it('buckets exactly at the mid threshold (0.5) as matrix-mid', () => {
    expect(matrixHeatClassName(0.5)).toBe('bg-matrix-mid text-ink');
  });

  it('buckets just below the high threshold (0.7499) as matrix-mid', () => {
    expect(matrixHeatClassName(0.7499)).toBe('bg-matrix-mid text-ink');
  });

  it('buckets exactly at the high threshold (0.75) as matrix-high, with paper text', () => {
    expect(matrixHeatClassName(0.75)).toBe('bg-matrix-high text-paper');
  });

  it('buckets 1 (the always-1.0 diagonal) as matrix-high', () => {
    expect(matrixHeatClassName(1)).toBe('bg-matrix-high text-paper');
  });
});
