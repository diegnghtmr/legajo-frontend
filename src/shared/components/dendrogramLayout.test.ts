import { describe, expect, it } from 'vitest';

import { computeDendrogramLayout, DendrogramLayoutError } from './dendrogramLayout';

/**
 * Golden n = 5 linkage matrix: leaves 0..4, the
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
  it('places leaves exactly in leafOrder order, never by their raw id (the leaf/vertical axis)', () => {
    const result = layout();
    const byId = new Map(result.leaves.map((leaf) => [leaf.id, leaf.y]));

    // leafOrder = [2, 3, 0, 1, 4] -> index 0..4 maps to y = 0, 25, 50, 75, 100.
    expect(byId.get(2)).toBe(0);
    expect(byId.get(3)).toBe(25);
    expect(byId.get(0)).toBe(50);
    expect(byId.get(1)).toBe(75);
    expect(byId.get(4)).toBe(100);
  });

  it('computes merge x purely from each row distance via a linear scale (width at distance 0, the leaves; 0 at the highest merge, the root)', () => {
    const result = layout();

    expect(result.maxDistance).toBe(4);
    expect(result.distanceToX(0)).toBe(400);
    expect(result.distanceToX(1)).toBe(300);
    expect(result.distanceToX(2)).toBe(200);
    expect(result.distanceToX(3)).toBe(100);
    expect(result.distanceToX(4)).toBe(0);
  });

  it('positions internal nodes at the midpoint y of their two children and at their own merge distance x', () => {
    const result = layout();

    const id5 = result.nodes.get(5); // children leaf 0 (y=50), leaf 1 (y=75)
    expect(id5).toEqual({ id: 5, x: 300, y: 62.5, isLeaf: false, distance: 1 });

    const id6 = result.nodes.get(6); // children leaf 2 (y=0), leaf 3 (y=25)
    expect(id6).toEqual({ id: 6, x: 200, y: 12.5, isLeaf: false, distance: 2 });

    const id7 = result.nodes.get(7); // children leaf 4 (y=100), cluster 5 (y=62.5)
    expect(id7).toEqual({ id: 7, x: 100, y: 81.25, isLeaf: false, distance: 3 });

    const id8 = result.nodes.get(8); // root: children cluster 6 (y=12.5), cluster 7 (y=81.25)
    expect(id8).toEqual({ id: 8, x: 0, y: 46.875, isLeaf: false, distance: 4 });
  });

  it('builds an elbow (U-shaped, rotated 90°) SVG path per row, from each child distance across to the other', () => {
    const result = layout();

    expect(result.links[0]?.path).toBe('M 400 50 H 300 V 75 H 400');
    expect(result.links[1]?.path).toBe('M 400 0 H 200 V 25 H 400');
    expect(result.links[2]?.path).toBe('M 400 100 H 100 V 62.5 H 300');
    expect(result.links[3]?.path).toBe('M 200 12.5 H 0 V 81.25 H 100');
  });

  it('renders two linkages with different leafOrder at different leaf y positions', () => {
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

    const firstYById = new Map(first.leaves.map((leaf) => [leaf.id, leaf.y]));
    const secondYById = new Map(second.leaves.map((leaf) => [leaf.id, leaf.y]));

    expect(firstYById.get(0)).not.toBe(secondYById.get(0));
    expect(firstYById.get(2)).not.toBe(secondYById.get(2));
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

  describe('with a fitted distance domain', () => {
    const fitted = () =>
      computeDendrogramLayout({
        rows: GOLDEN_ROWS,
        leafOrder: GOLDEN_LEAF_ORDER,
        width: WIDTH,
        height: HEIGHT,
        domain: [0.5, 4.5],
      });

    it('maps the domain end to the root side and the domain start to the leaf side', () => {
      const result = fitted();

      expect(result.distanceToX(0.5)).toBe(400);
      expect(result.distanceToX(4.5)).toBe(0);
      expect(result.distanceToX(2.5)).toBe(200);
    });

    it('keeps every leaf on the leaf side, whatever the smallest merge is', () => {
      const result = fitted();

      for (const leaf of result.leaves) {
        expect(result.nodes.get(leaf.id)!.x).toBe(400);
      }
      expect(result.links[0]!.x).toBe(result.distanceToX(1));
    });
  });

  it('lists the leaves under every node, leaves themselves included', () => {
    const result = layout();

    expect(result.leavesOf.get(0)).toEqual([0]);
    expect(result.leavesOf.get(5)).toEqual([0, 1]);
    expect(result.leavesOf.get(7)).toEqual([4, 0, 1]);
    expect([...result.leavesOf.get(8)!].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
