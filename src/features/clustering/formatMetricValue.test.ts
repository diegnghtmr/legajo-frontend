import { describe, expect, it } from 'vitest';

import { formatMetricValue } from './formatMetricValue';

describe('formatMetricValue', () => {
  it('shows an integer verbatim, with no decimal point', () => {
    expect(formatMetricValue(1)).toBe('1');
    expect(formatMetricValue(0)).toBe('0');
  });

  it('rounds a non-integer to 4 decimals, same precision as the similarity table', () => {
    expect(formatMetricValue(0.842103333)).toBe('0.8421');
  });

  it('keeps a negative silhouette value (the metric ranges [-1, 1])', () => {
    expect(formatMetricValue(-0.25)).toBe('-0.2500');
  });
});
