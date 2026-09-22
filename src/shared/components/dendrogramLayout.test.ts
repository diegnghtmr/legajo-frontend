import { describe, expect, it } from 'vitest';

import { computeDendrogramLayout, DendrogramLayoutError } from './dendrogramLayout';

/**
 * Golden n = 5 linkage matrix (TRD §6.4 conventions): leaves 0..4, the
 * cluster created by row i (0-based) gets id n + i. `leafOrder` is
 * deliberately not the identity permutation so a bug that positions leaves
 * by `id` instead of by their index in `leafOrder` is caught.
 *
 *   row 0: (0, 1) -> id 5, distance 1
 *   row 1: (2, 3) -> id 6, distance 2
 *   row 2: (4, 5) -> id 7, distance 3   (leaf 4 with cluster 5)
 *   row 3: (6, 7) -> id 8, distance 4   (root)
 */
const GOLDEN_ROWS = [
  { idx1: 0, idx2: 1, mergeDistance: 1 },
  { idx1: 2, idx2: 3, mergeDistance: 2 },
  { idx1: 4, idx2: 5, mergeDistance: 3 },
  { idx1: 6, idx2: 7, mergeDistance: 4 },
];
const GOLDEN_LEAF_ORDER = [2, 3, 0, 1, 4];
const WIDTH = 400;
const HEIGHT = 100;

function layout() {
  return computeDendrogramLayout({
    rows: GOLDEN_ROWS,
    leafOrder: GOLDEN_LEAF_ORDER,
    width: WIDTH,
    height: HEIGHT,
  });
}

describe('computeDendrogramLayout', () => {
  it('places leaves exactly in leafOrder order, never by their raw id', () => {
    const result = layout();
    const byId = new Map(result.leaves.map((leaf) => [leaf.id, leaf.x]));

    // leafOrder = [2, 3, 0, 1, 4] -> index 0..4 maps to x = 0, 100, 200, 300, 400.
    expect(byId.get(2)).toBe(0);
    expect(byId.get(3)).toBe(100);
    expect(byId.get(0)).toBe(200);
    expect(byId.get(1)).toBe(300);
    expect(byId.get(4)).toBe(400);
  });

  it('computes merge y purely from each row distance via a linear scale (0 at leaves)', () => {
    const result = layout();

    expect(result.maxDistance).toBe(4);
    expect(result.distanceToY(0)).toBe(100);
    expect(result.distanceToY(1)).toBe(75);
    expect(result.distanceToY(2)).toBe(50);
    expect(result.distanceToY(3)).toBe(25);
    expect(result.distanceToY(4)).toBe(0);
  });

  it('positions internal nodes at the midpoint x of their two children and at their own merge height', () => {
    const result = layout();

    const id5 = result.nodes.get(5); // children leaf 0 (x=200), leaf 1 (x=300)
    expect(id5).toEqual({ id: 5, x: 250, y: 75, isLeaf: false, distance: 1 });

    const id6 = result.nodes.get(6); // children leaf 2 (x=0), leaf 3 (x=100)
    expect(id6).toEqual({ id: 6, x: 50, y: 50, isLeaf: false, distance: 2 });

    const id7 = result.nodes.get(7); // children leaf 4 (x=400), cluster 5 (x=250)
    expect(id7).toEqual({ id: 7, x: 325, y: 25, isLeaf: false, distance: 3 });

    const id8 = result.nodes.get(8); // root: children cluster 6 (x=50), cluster 7 (x=325)
    expect(id8).toEqual({ id: 8, x: 187.5, y: 0, isLeaf: false, distance: 4 });
  });

  it('builds an elbow (U-shaped) SVG path per row, from each child height across to the other', () => {
    const result = layout();

    expect(result.links[0]?.path).toBe('M 200 100 V 75 H 300 V 100');
    expect(result.links[1]?.path).toBe('M 0 100 V 50 H 100 V 100');
    expect(result.links[2]?.path).toBe('M 400 100 V 25 H 250 V 75');
    expect(result.links[3]?.path).toBe('M 50 50 V 0 H 325 V 25');
  });

  it('renders two linkages with different leafOrder at different leaf x positions', () => {
    const first = computeDendrogramLayout({
      rows: GOLDEN_ROWS,
      leafOrder: [0, 1, 2, 3, 4],
      width: WIDTH,
      height: HEIGHT,
    });
    const second = computeDendrogramLayout({
      rows: GOLDEN_ROWS,
      leafOrder: GOLDEN_LEAF_ORDER,
      width: WIDTH,
      height: HEIGHT,
    });

    const firstXById = new Map(first.leaves.map((leaf) => [leaf.id, leaf.x]));
    const secondXById = new Map(second.leaves.map((leaf) => [leaf.id, leaf.x]));

    expect(firstXById.get(0)).not.toBe(secondXById.get(0));
    expect(firstXById.get(2)).not.toBe(secondXById.get(2));
  });

  it('rejects a row count that is not exactly n - 1', () => {
    expect(() =>
      computeDendrogramLayout({
        rows: GOLDEN_ROWS.slice(0, 3),
        leafOrder: GOLDEN_LEAF_ORDER,
        width: WIDTH,
        height: HEIGHT,
      }),
    ).toThrow(DendrogramLayoutError);
  });

  it('rejects a row whose idx1 is not strictly less than idx2', () => {
    const malformed = [
      { idx1: 1, idx2: 0, mergeDistance: 1 },
      { idx1: 2, idx2: 3, mergeDistance: 2 },
      { idx1: 4, idx2: 5, mergeDistance: 3 },
      { idx1: 6, idx2: 7, mergeDistance: 4 },
    ];

    expect(() =>
      computeDendrogramLayout({
        rows: malformed,
        leafOrder: GOLDEN_LEAF_ORDER,
        width: WIDTH,
        height: HEIGHT,
      }),
    ).toThrow(DendrogramLayoutError);
  });

  it('rejects an idx1/idx2 that equal each other', () => {
    const malformed = [
      { idx1: 0, idx2: 0, mergeDistance: 1 },
      { idx1: 2, idx2: 3, mergeDistance: 2 },
      { idx1: 4, idx2: 5, mergeDistance: 3 },
      { idx1: 6, idx2: 7, mergeDistance: 4 },
    ];

    expect(() =>
      computeDendrogramLayout({
        rows: malformed,
        leafOrder: GOLDEN_LEAF_ORDER,
        width: WIDTH,
        height: HEIGHT,
      }),
    ).toThrow(DendrogramLayoutError);
  });

  it('rejects an idx that references a not-yet-created cluster (out of range)', () => {
    const malformed = [
      { idx1: 0, idx2: 1, mergeDistance: 1 },
      { idx1: 2, idx2: 3, mergeDistance: 2 },
      { idx1: 4, idx2: 5, mergeDistance: 3 },
      { idx1: 6, idx2: 20, mergeDistance: 4 }, // 20 was never created
    ];

    expect(() =>
      computeDendrogramLayout({
        rows: malformed,
        leafOrder: GOLDEN_LEAF_ORDER,
        width: WIDTH,
        height: HEIGHT,
      }),
    ).toThrow(DendrogramLayoutError);
  });

  it('rejects a leafOrder that is not a permutation of 0..n-1 (duplicate)', () => {
    expect(() =>
      computeDendrogramLayout({
        rows: GOLDEN_ROWS,
        leafOrder: [0, 1, 2, 3, 3],
        width: WIDTH,
        height: HEIGHT,
      }),
    ).toThrow(DendrogramLayoutError);
  });

  it('rejects a leafOrder with a value out of range', () => {
    expect(() =>
      computeDendrogramLayout({
        rows: GOLDEN_ROWS,
        leafOrder: [0, 1, 2, 3, 7],
        width: WIDTH,
        height: HEIGHT,
      }),
    ).toThrow(DendrogramLayoutError);
  });
});
