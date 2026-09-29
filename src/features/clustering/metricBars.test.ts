import { describe, expect, it } from 'vitest';

import { barFraction, columnBest, metricSeries } from './metricBars';

describe('columnBest', () => {
  it('is the maximum for a higher-is-better column', () => {
    expect(columnBest([0.2, 0.9, null, 0.5], 'higher')).toBe(0.9);
  });

  it('is the smallest positive value for a lower-is-better column', () => {
    expect(columnBest([0.6, 0.1, null, 0.2], 'lower')).toBe(0.1);
    expect(columnBest([0, -1, 0.4], 'lower')).toBe(0.4);
  });

  it('is undefined when no value is usable', () => {
    expect(columnBest([null, Number.NaN], 'higher')).toBeUndefined();
    expect(columnBest([], 'lower')).toBeUndefined();
  });
});

describe('barFraction', () => {
  it('is value / best for a higher-is-better column', () => {
    expect(barFraction(0.45, 0.9, 'higher')).toBeCloseTo(0.5, 10);
    expect(barFraction(0.9, 0.9, 'higher')).toBe(1);
  });

  it('is best / value for a lower-is-better column', () => {
    expect(barFraction(0.4, 0.2, 'lower')).toBeCloseTo(0.5, 10);
    expect(barFraction(0.2, 0.2, 'lower')).toBe(1);
  });

  it('never drops below the 4% stub nor above 100%', () => {
    expect(barFraction(0.001, 1, 'higher')).toBe(0.04);
    expect(barFraction(2, 1, 'higher')).toBe(1);
    expect(barFraction(100, 0.1, 'lower')).toBe(0.04);
  });

  it('shows the stub for an undefined, non-positive or non-finite value', () => {
    expect(barFraction(null, 1, 'lower')).toBe(0.04);
    expect(barFraction(0, 1, 'higher')).toBe(0.04);
    expect(barFraction(-0.3, 0.9, 'higher')).toBe(0.04);
    expect(barFraction(Number.NaN, 1, 'higher')).toBe(0.04);
  });

  it('shows the stub when the column has no usable best', () => {
    expect(barFraction(0.5, undefined, 'higher')).toBe(0.04);
    expect(barFraction(0.5, -0.1, 'higher')).toBe(0.04);
  });
});

describe('metricSeries', () => {
  it('lists every k of a record ascending, numerically, keeping an undefined value as null', () => {
    expect(metricSeries({ '10': 0.1, '2': 0.5, '4': null })).toEqual([
      { k: 2, value: 0.5 },
      { k: 4, value: null },
      { k: 10, value: 0.1 },
    ]);
  });

  it('is empty for an empty record', () => {
    expect(metricSeries({})).toEqual([]);
  });
});
