import { describe, expect, it } from 'vitest';

import { formatDuration, toNanoseconds } from './units';

describe('toNanoseconds', () => {
  it('converts ns/op as-is', () => {
    expect(toNanoseconds(195, 'ns/op')).toBe(195);
  });

  it('converts us/op to nanoseconds', () => {
    expect(toNanoseconds(7.5, 'us/op')).toBeCloseTo(7500, 6);
  });

  it('converts ms/op to nanoseconds', () => {
    expect(toNanoseconds(11.6, 'ms/op')).toBeCloseTo(11_600_000, 6);
  });

  it('throws on an unrecognized JMH unit', () => {
    expect(() => toNanoseconds(1, 'op/s')).toThrow(/op\/s/);
  });
});

describe('formatDuration', () => {
  it('formats sub-microsecond values in ns', () => {
    expect(formatDuration(195)).toBe('195 ns');
  });

  it('formats sub-millisecond values in µs', () => {
    expect(formatDuration(7_500)).toBe('7.5 µs');
  });

  it('formats sub-second values in ms', () => {
    expect(formatDuration(11_600_000)).toBe('11.6 ms');
  });

  it('formats second-scale values in s', () => {
    expect(formatDuration(2_500_000_000)).toBe('2.5 s');
  });
});
