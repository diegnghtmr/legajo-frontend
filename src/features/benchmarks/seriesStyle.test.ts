import { describe, expect, it } from 'vitest';

import { dashPatternForIndex, hueForIndex, markerShapeForIndex } from './seriesStyle';

describe('dashPatternForIndex', () => {
  it('assigns a distinct dash pattern for the first four series, solid first', () => {
    expect(dashPatternForIndex(0)).toBe('');
    expect(dashPatternForIndex(1)).not.toBe('');
    expect(dashPatternForIndex(2)).not.toBe(dashPatternForIndex(1));
    expect(dashPatternForIndex(3)).not.toBe(dashPatternForIndex(2));
  });

  it('cycles back to the first pattern past the fixed set', () => {
    expect(dashPatternForIndex(4)).toBe(dashPatternForIndex(0));
  });

  it('wraps a negative index to the same pattern as its positive equivalent (safe modulo)', () => {
    expect(dashPatternForIndex(-1)).toBe(dashPatternForIndex(3));
  });
});

describe('markerShapeForIndex', () => {
  it('assigns a distinct marker shape for the first four series', () => {
    const shapes = [0, 1, 2, 3].map(markerShapeForIndex);
    expect(new Set(shapes).size).toBe(4);
  });

  it('cycles back to the first shape past the fixed set', () => {
    expect(markerShapeForIndex(4)).toBe(markerShapeForIndex(0));
  });

  it('wraps a negative index to the same shape as its positive equivalent (safe modulo)', () => {
    expect(markerShapeForIndex(-1)).toBe(markerShapeForIndex(3));
  });
});

describe('hueForIndex', () => {
  it('assigns the cluster hues in order, one per series position', () => {
    expect(hueForIndex(0)).toBe('var(--color-cluster-1)');
    expect(hueForIndex(3)).toBe('var(--color-cluster-4)');
  });

  it('cycles back to the first hue after the eight cluster hues', () => {
    expect(hueForIndex(8)).toBe(hueForIndex(0));
  });

  it('wraps a negative index to the same hue as its positive equivalent (safe modulo)', () => {
    expect(hueForIndex(-1)).toBe(hueForIndex(7));
  });
});
