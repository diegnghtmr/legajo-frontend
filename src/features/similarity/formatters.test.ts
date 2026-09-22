import { describe, expect, it } from 'vitest';

import { formatComputedNanos, formatRawValue } from './formatters';

describe('formatComputedNanos', () => {
  it('formats an integer nanosecond count with locale thousands separators (es)', () => {
    expect(formatComputedNanos(1234567, 'es')).toBe('1.234.567');
  });

  it('formats the same value with en-US separators', () => {
    expect(formatComputedNanos(1234567, 'en')).toBe('1,234,567');
  });

  it('formats a small value with no separator needed', () => {
    expect(formatComputedNanos(42, 'es')).toBe('42');
  });
});

describe('formatRawValue', () => {
  it('returns null for a null raw value (degenerate case, TAC-05)', () => {
    expect(formatRawValue(null)).toBeNull();
  });

  it('formats an integer raw value with no decimals', () => {
    expect(formatRawValue(5)).toBe('5');
  });

  it('formats a non-integer raw value to 4 decimals', () => {
    expect(formatRawValue(0.123456789)).toBe('0.1235');
  });
});
