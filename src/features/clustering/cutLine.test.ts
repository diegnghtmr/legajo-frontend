import { describe, expect, it } from 'vitest';

import { computeCutDistance, CutLineError } from './cutLine';

/** n = 5 (4 rows), distances already in ascending merge order (TRD §6.4). */
const ROWS = [
  { mergeDistance: 1 },
  { mergeDistance: 2 },
  { mergeDistance: 3 },
  { mergeDistance: 4 },
];

describe('computeCutDistance', () => {
  it('sits midway between the (n-k)-th and (n-k+1)-th merge distances for k=3', () => {
    // n=5, k=3 -> n-k=2 kept merges (distances 1, 2) -> cut between the 2nd (2) and 3rd (3).
    expect(computeCutDistance(ROWS, 3)).toBe(2.5);
  });

  it('sits between the first two merges for the smallest allowed k (n-1)', () => {
    // n=5, k=4 -> n-k=1 -> cut between the 1st (1) and 2nd (2) merge distances.
    expect(computeCutDistance(ROWS, 4)).toBe(1.5);
  });

  it('sits between the last two merges for the largest allowed k (2)', () => {
    // n=5, k=2 -> n-k=3 -> cut between the 3rd (3) and 4th (4) merge distances.
    expect(computeCutDistance(ROWS, 2)).toBe(3.5);
  });

  it('sorts distances defensively rather than assuming row order', () => {
    const shuffled = [
      { mergeDistance: 3 },
      { mergeDistance: 1 },
      { mergeDistance: 4 },
      { mergeDistance: 2 },
    ];
    expect(computeCutDistance(shuffled, 3)).toBe(2.5);
  });

  it('rejects k below 2', () => {
    expect(() => computeCutDistance(ROWS, 1)).toThrow(CutLineError);
  });

  it('rejects k at or above n', () => {
    expect(() => computeCutDistance(ROWS, 5)).toThrow(CutLineError);
  });

  it('rejects a non-integer k', () => {
    expect(() => computeCutDistance(ROWS, 2.5)).toThrow(CutLineError);
  });
});
