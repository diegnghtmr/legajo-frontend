import { describe, expect, it } from 'vitest';

import { dendrogramCardHeight } from './dendrogramGridSizing';

describe('dendrogramCardHeight', () => {
  it('clamps a very small leaf count to the minimum readable height', () => {
    expect(dendrogramCardHeight(2)).toBe(220);
  });

  it('grows with the leaf count between the clamped bounds', () => {
    const small = dendrogramCardHeight(10);
    const large = dendrogramCardHeight(30);
    expect(large).toBeGreaterThan(small);
  });

  it('clamps a very large leaf count to the maximum grid-card height', () => {
    expect(dendrogramCardHeight(500)).toBe(640);
  });

  it('rejects a non-integer leaf count', () => {
    expect(() => dendrogramCardHeight(3.5)).toThrow(RangeError);
  });

  it('rejects a negative leaf count', () => {
    expect(() => dendrogramCardHeight(-1)).toThrow(RangeError);
  });
});
