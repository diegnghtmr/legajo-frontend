import { describe, expect, it } from 'vitest';

import type { FamilySeries } from './grouping';
import { buildPlotModel, errorKey, theoreticalKey, whiskerBounds } from './plotModel';

const SERIES: FamilySeries[] = [
  {
    family: 'levenshtein',
    points: [
      { size: 50, valueNs: 7_900, errorNs: 400 },
      { size: 100, valueNs: 29_600, errorNs: 0 },
    ],
  },
  {
    family: 'jaccard',
    points: [
      { size: 50, valueNs: 4_500, errorNs: 100 },
      { size: 100, valueNs: 20_300, errorNs: 900 },
    ],
  },
];

const SLOPES = new Map([['levenshtein', { empiricalSlope: 2.04, theoreticalExponent: 2 }]]);

describe('whiskerBounds', () => {
  it('extends symmetrically by the error when the floor is out of reach', () => {
    expect(whiskerBounds(1_000, 100, 0)).toEqual([100, 100]);
  });

  it('clips the lower arm at the axis floor instead of crossing it', () => {
    // value - floor = 200 < error 500: the arm stops at the floor.
    expect(whiskerBounds(1_000, 500, 800)).toEqual([200, 500]);
  });

  it('never returns a negative lower arm for a value already under the floor', () => {
    expect(whiskerBounds(100, 50, 800)).toEqual([0, 50]);
  });
});

describe('buildPlotModel', () => {
  it('merges the series into one row per size, with theoretical values only where a slope exists', () => {
    const { rows } = buildPlotModel(SERIES, SLOPES, 'linear');

    expect(rows.map((row) => row.size)).toEqual([50, 100]);
    expect(rows[0]).toMatchObject({ levenshtein: 7_900, jaccard: 4_500 });
    expect(rows[0]?.[theoreticalKey('levenshtein')]).toBeCloseTo(7_900);
    expect(rows[1]?.[theoreticalKey('levenshtein')]).toBeCloseTo(7_900 * 4);
    expect(rows[0]).not.toHaveProperty(theoreticalKey('jaccard'));
  });

  it('adds an asymmetric error arm per point that reports a non-zero error, and none otherwise', () => {
    const { rows } = buildPlotModel(SERIES, SLOPES, 'linear');

    expect(rows[0]?.[errorKey('levenshtein')]).toEqual([400, 400]);
    expect(rows[1]).not.toHaveProperty(errorKey('levenshtein'));
    expect(rows[1]?.[errorKey('jaccard')]).toEqual([900, 900]);
  });

  it('uses automatic ticks on the linear scale', () => {
    const { yTicks, yDomain } = buildPlotModel(SERIES, SLOPES, 'linear');

    expect(yTicks).toEqual([]);
    expect(yDomain).toEqual(['auto', 'auto']);
  });

  it('puts the log-log y ticks on decades that cover every value and its upper whisker', () => {
    const { yTicks, yDomain } = buildPlotModel(SERIES, SLOPES, 'log-log');

    expect(yTicks).toEqual([1_000, 10_000, 100_000]);
    expect(yDomain[0]).toBeCloseTo(1_000 / Math.sqrt(10));
    expect(yDomain[1]).toBeCloseTo(100_000 * Math.sqrt(10));
  });

  it('clips a log-log whisker that would cross the axis floor', () => {
    const wide: FamilySeries[] = [
      {
        family: 'levenshtein',
        points: [
          { size: 50, valueNs: 1_000, errorNs: 900_000 },
          { size: 100, valueNs: 10_000, errorNs: 0 },
        ],
      },
    ];
    const { rows, yDomain } = buildPlotModel(wide, new Map(), 'log-log');
    const [lower] = rows[0]?.[errorKey('levenshtein')] as [number, number];

    expect(lower).toBeCloseTo(1_000 - (yDomain[0] as number));
    expect(lower).toBeLessThan(900_000);
  });

  it('drops non-positive points from the log-log plot only', () => {
    const withZero: FamilySeries[] = [
      {
        family: 'levenshtein',
        points: [
          { size: 0, valueNs: 5, errorNs: 0 },
          { size: 10, valueNs: 100, errorNs: 0 },
          { size: 20, valueNs: 400, errorNs: 0 },
        ],
      },
    ];

    expect(buildPlotModel(withZero, new Map(), 'log-log').rows.map((row) => row.size)).toEqual([
      10, 20,
    ]);
    expect(buildPlotModel(withZero, new Map(), 'linear').rows.map((row) => row.size)).toEqual([
      0, 10, 20,
    ]);
  });
});
