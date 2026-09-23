import { describe, expect, it } from 'vitest';

import { theoreticalCurvePoints } from './theoreticalCurve';

describe('theoreticalCurvePoints', () => {
  it('anchors exactly at the first empirical point', () => {
    const points = [
      { size: 50, valueNs: 100 },
      { size: 100, valueNs: 400 },
    ];

    const curve = theoreticalCurvePoints(points, 2);

    expect(curve[0]).toEqual({ size: 50, valueNs: 100 });
  });

  it('follows the theoretical power law from the anchor (O(n^2) quadruples on doubling)', () => {
    const points = [
      { size: 50, valueNs: 100 },
      { size: 100, valueNs: 999 }, // empirical noise; the theoretical curve ignores it
    ];

    const curve = theoreticalCurvePoints(points, 2);

    expect(curve[1]!.size).toBe(100);
    expect(curve[1]!.valueNs).toBeCloseTo(400, 6);
  });

  it('handles a linear exponent (O(n))', () => {
    const points = [
      { size: 5, valueNs: 10 },
      { size: 20, valueNs: 1000 },
    ];

    const curve = theoreticalCurvePoints(points, 1);

    expect(curve[1]!.valueNs).toBeCloseTo(40, 6);
  });

  it('returns an empty array for no points', () => {
    expect(theoreticalCurvePoints([], 2)).toEqual([]);
  });
});
