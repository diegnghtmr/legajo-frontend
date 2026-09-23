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

  it('rejects a unit that collides with an inherited Object.prototype property', () => {
    expect(() => toNanoseconds(1, 'constructor')).toThrow(/constructor/);
    expect(() => toNanoseconds(1, 'toString')).toThrow(/toString/);
    expect(() => toNanoseconds(1, '__proto__')).toThrow(/__proto__/);
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

  it('picks the unit after rounding: 999_999_999 ns rounds up to 1000.0 ms, which bumps to 1 s', () => {
    expect(formatDuration(999_999_999)).toBe('1 s');
  });

  it('picks the unit after rounding: 999.96 ns rounds up to 1000.0 ns, which bumps to 1 µs', () => {
    expect(formatDuration(999.96)).toBe('1 µs');
  });

  it('does not bump the unit for a value that rounds to just under the next order of magnitude', () => {
    expect(formatDuration(999.94)).toBe('999.9 ns');
  });
});
