import { describe, expect, it } from 'vitest';

import { fitDistanceDomain, niceTicks, tickDecimals } from './distanceAxis';

describe('fitDistanceDomain', () => {
  it('starts 12% of the range below the smallest merge and ends 4% above the largest', () => {
    const [start, end] = fitDistanceDomain([1, 2, 3, 4]);

    expect(start).toBeCloseTo(1 - 0.12 * 3, 10);
    expect(end).toBeCloseTo(4 + 0.04 * 3, 10);
  });

  it('never starts below zero', () => {
    const [start] = fitDistanceDomain([0.05, 1, 2]);

    expect(start).toBe(0);
  });

  it('keeps a non-empty domain when every merge is at the same distance', () => {
    const [start, end] = fitDistanceDomain([2, 2, 2]);

    expect(end).toBeGreaterThan(start);
    expect(start).toBeLessThanOrEqual(2);
    expect(end).toBeGreaterThanOrEqual(2);
  });

  it('keeps a non-empty domain when every merge is at zero', () => {
    const [start, end] = fitDistanceDomain([0, 0]);

    expect(start).toBe(0);
    expect(end).toBeGreaterThan(0);
  });
});

describe('niceTicks', () => {
  it('uses steps of 1, 2, 2.5 or 5 times a power of ten', () => {
    for (const [start, end, count] of [
      [0, 10, 5],
      [0.2, 3.1, 5],
      [0, 1, 4],
      [0.3, 0.9, 3],
      [12, 480, 6],
    ] as const) {
      const ticks = niceTicks(start, end, count);
      const step = ticks[1]! - ticks[0]!;
      const mantissa = step / 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 2.5, 5]).toContain(Number(mantissa.toFixed(6)));
    }
  });

  it('returns ticks inside the domain, ascending, on multiples of the step', () => {
    const ticks = niceTicks(0.2, 3.1, 5);

    expect(ticks[0]).toBeGreaterThanOrEqual(0.2);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(3.1);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(ticks).toEqual([0.5, 1, 1.5, 2, 2.5, 3]);
  });

  it('asks for about the requested number of ticks', () => {
    expect(niceTicks(0, 10, 5).length).toBeGreaterThanOrEqual(3);
    expect(niceTicks(0, 10, 5).length).toBeLessThanOrEqual(8);
  });

  it('returns a single tick for an empty domain', () => {
    expect(niceTicks(2, 2, 5)).toEqual([2]);
  });
});

describe('tickDecimals', () => {
  it('is the number of decimals a step needs', () => {
    expect(tickDecimals(1)).toBe(0);
    expect(tickDecimals(2.5)).toBe(1);
    expect(tickDecimals(0.25)).toBe(2);
    expect(tickDecimals(0.05)).toBe(2);
    expect(tickDecimals(50)).toBe(0);
  });
});
