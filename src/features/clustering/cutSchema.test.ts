import { describe, expect, it } from 'vitest';

import { buildCutSchema, cutKRange, isValidCutK } from './cutSchema';

describe('cutKRange', () => {
  it('bounds k to [2, n - 1]', () => {
    expect(cutKRange(20)).toEqual({ min: 2, max: 19, hasRange: true });
  });

  it('has no valid k below three observations', () => {
    expect(cutKRange(2).hasRange).toBe(false);
    expect(cutKRange(3)).toEqual({ min: 2, max: 2, hasRange: true });
  });
});

describe('isValidCutK', () => {
  it('accepts whole numbers inside the range, bounds included', () => {
    expect(isValidCutK(2, 6)).toBe(true);
    expect(isValidCutK(5, 6)).toBe(true);
  });

  it('rejects out-of-range, fractional and empty values', () => {
    expect(isValidCutK(1, 6)).toBe(false);
    expect(isValidCutK(6, 6)).toBe(false);
    expect(isValidCutK(2.5, 6)).toBe(false);
    expect(isValidCutK(Number.NaN, 6)).toBe(false);
  });
});

describe('buildCutSchema', () => {
  it('parses a linkage and a k inside the range', () => {
    expect(buildCutSchema(6).safeParse({ linkage: 'ward', k: 3 }).success).toBe(true);
  });

  it('rejects an unknown linkage and an out-of-range k', () => {
    expect(buildCutSchema(6).safeParse({ linkage: 'median', k: 3 }).success).toBe(false);
    expect(buildCutSchema(6).safeParse({ linkage: 'ward', k: 6 }).success).toBe(false);
  });
});
