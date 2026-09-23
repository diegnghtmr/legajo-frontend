import { describe, expect, it } from 'vitest';

import { formatMeasuredAt, formatRamBytes } from './formatHarness';

describe('formatRamBytes', () => {
  it('formats bytes as GB with one decimal', () => {
    expect(formatRamBytes(33_363_460_096)).toBe('31.1 GB');
  });

  it('formats an exact gigabyte', () => {
    expect(formatRamBytes(8 * 1024 ** 3)).toBe('8.0 GB');
  });
});

describe('formatMeasuredAt', () => {
  it('drops sub-second precision from an ISO instant', () => {
    expect(formatMeasuredAt('2026-09-23T00:43:04.800549029Z')).toBe('2026-09-23T00:43:04Z');
  });

  it('returns the raw string unchanged if it cannot be parsed as a date', () => {
    expect(formatMeasuredAt('not-a-date')).toBe('not-a-date');
  });
});
