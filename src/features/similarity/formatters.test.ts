import { describe, expect, it } from 'vitest';

import { formatComputedNanos, formatRawValue, formatTraceNumber } from './formatters';

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

describe('formatTraceNumber', () => {
  it('renders an integer verbatim, with no decimal point', () => {
    expect(formatTraceNumber(5)).toBe('5');
    expect(formatTraceNumber(0)).toBe('0');
    expect(formatTraceNumber(-3)).toBe('-3');
  });

  it('renders a non-integer to 6 decimals, the interface displays what the backend sent verbatim', () => {
    expect(formatTraceNumber(0.123456789)).toBe('0.123457');
    expect(formatTraceNumber(-0.5)).toBe('-0.500000');
  });
});
