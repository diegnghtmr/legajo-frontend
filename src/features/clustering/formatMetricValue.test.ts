import { describe, expect, it } from 'vitest';

import { formatMetricValue } from './formatMetricValue';

describe('formatMetricValue', () => {
  it('shows three decimals, integers included, so a column reads at a glance', () => {
    expect(formatMetricValue(1)).toBe('1.000');
    expect(formatMetricValue(0)).toBe('0.000');
  });

  it('rounds a non-integer to 3 decimals', () => {
    expect(formatMetricValue(0.842103333)).toBe('0.842');
  });

  it('keeps a negative silhouette value (the metric ranges [-1, 1])', () => {
    expect(formatMetricValue(-0.25)).toBe('-0.250');
  });
});
