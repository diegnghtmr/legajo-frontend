import { describe, expect, it } from 'vitest';

import { dendrogramCardHeight } from './dendrogramGridSizing';

describe('dendrogramCardHeight', () => {
  it('is (n - 1) x 22 + 60 px', () => {
    expect(dendrogramCardHeight(20)).toBe(478);
    expect(dendrogramCardHeight(6)).toBe(170);
  });

  it('grows 22px per extra leaf, with no upper clamp', () => {
    expect(dendrogramCardHeight(31) - dendrogramCardHeight(30)).toBe(22);
    expect(dendrogramCardHeight(500)).toBe(499 * 22 + 60);
  });

  it('keeps the 60px of chrome for a corpus with at most one leaf', () => {
    expect(dendrogramCardHeight(1)).toBe(60);
    expect(dendrogramCardHeight(0)).toBe(60);
  });

  it('rejects a non-integer leaf count', () => {
    expect(() => dendrogramCardHeight(3.5)).toThrow(RangeError);
  });

  it('rejects a negative leaf count', () => {
    expect(() => dendrogramCardHeight(-1)).toThrow(RangeError);
  });
});
