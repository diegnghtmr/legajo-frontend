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

  it('anchors at the smallest strictly positive size after sorting, not simply points[0], for unsorted input', () => {
    // Noisy first point (size 100): anchoring on it (the old points[0] rule)
    // would predict a different value at size 50 than anchoring correctly
    // on the smallest size.
    const points = [
      { size: 100, valueNs: 999 },
      { size: 50, valueNs: 100 },
    ];

    const curve = theoreticalCurvePoints(points, 2);

    expect(curve.find((point) => point.size === 50)?.valueNs).toBeCloseTo(100, 6);
    expect(curve.find((point) => point.size === 100)?.valueNs).toBeCloseTo(400, 6);
  });

  it('skips a non-positive size instead of anchoring on it or producing Infinity/NaN', () => {
    const points = [
      { size: 0, valueNs: 1_000_000 },
      { size: 50, valueNs: 100 },
      { size: 100, valueNs: 400 },
    ];

    const curve = theoreticalCurvePoints(points, 2);

    expect(curve.some((point) => point.size === 0)).toBe(false);
    for (const point of curve) {
      expect(Number.isFinite(point.valueNs)).toBe(true);
    }
    expect(curve.find((point) => point.size === 50)?.valueNs).toBeCloseTo(100, 6);
    expect(curve.find((point) => point.size === 100)?.valueNs).toBeCloseTo(400, 6);
  });
});
