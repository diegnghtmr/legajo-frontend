import { describe, expect, it } from 'vitest';

import { formatCpuModel, formatMeasuredAt, formatRamGib, localeForLanguage } from './formatHarness';

describe('formatCpuModel', () => {
  it('renders the (R) and (TM) marks as the registered and trade mark glyphs', () => {
    expect(formatCpuModel('12th Gen Intel(R) Core(TM) i9-12900H')).toBe(
      '12th Gen Intel® Core™ i9-12900H',
    );
  });

  it('leaves a model without marks unchanged', () => {
    expect(formatCpuModel('Apple M3 Pro')).toBe('Apple M3 Pro');
  });

  it('replaces every occurrence, whatever the case of the mark', () => {
    expect(formatCpuModel('Vendor(r) Chip(tm) X(R)')).toBe('Vendor® Chip™ X®');
  });
});

describe('formatRamGib', () => {
  it('formats bytes as GiB with one decimal', () => {
    expect(formatRamGib(33_363_460_096)).toBe('31.1 GiB');
  });

  it('formats an exact gibibyte', () => {
    expect(formatRamGib(8 * 1024 ** 3)).toBe('8.0 GiB');
  });
});

describe('localeForLanguage', () => {
  it('maps the two UI languages to their date locale', () => {
    expect(localeForLanguage('es')).toBe('es');
    expect(localeForLanguage('en')).toBe('en-US');
  });

  it('falls back to the default language locale for anything else', () => {
    expect(localeForLanguage('fr')).toBe('es');
  });
});

describe('formatMeasuredAt', () => {
  const INSTANT = '2026-09-23T00:43:04.800549029Z';

  it('shows a medium date and a short 24-hour time in UTC, in Spanish', () => {
    // ICU spells the month differently across versions ("sept", "sep."), so
    // the month is not pinned; the day, year, UTC time and suffix are.
    expect(formatMeasuredAt(INSTANT, 'es')).toMatch(/^23 .+ 2026,? 00:43 UTC$/);
  });

  it('shows the same instant the English way', () => {
    expect(formatMeasuredAt(INSTANT, 'en')).toMatch(/^Sep 23, 2026,? 00:43 UTC$/);
  });

  it('reads the instant in UTC, whatever the machine time zone', () => {
    expect(formatMeasuredAt('2026-09-23T23:59:00Z', 'en')).toMatch(/Sep 23, 2026,? 23:59 UTC$/);
  });

  it('returns the raw string unchanged if it cannot be parsed as a date', () => {
    expect(formatMeasuredAt('not-a-date', 'es')).toBe('not-a-date');
  });
});
