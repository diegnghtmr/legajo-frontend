import { scaleLinear } from 'd3-scale';

/**
 * One row of a linkage matrix (TRD §6.4): the observation ids are `0..n-1`;
 * the cluster created by row `i` (0-based) receives id `n + i`; `idx1 <
 * idx2` always; distances are non-decreasing across rows. This shape mirrors
 * `LinkageStepSchema` (`infrastructure/schemas/clustering.ts`) but is kept
 * local so this module never depends on the network schema layer — it only
 * draws from whatever rows it is handed.
 */
export interface DendrogramRow {
  idx1: number;
  idx2: number;
  mergeDistance: number;
}

export interface DendrogramLeafPosition {
  /** Original observation id, `0..n-1`. */
  id: number;
  /** Pixel x, driven only by this id's position in `leafOrder` — never by `id` itself. */
  x: number;
}

export interface DendrogramNodePosition {
  id: number;
  x: number;
  y: number;
  isLeaf: boolean;
  /** `0` for a leaf; the row's `mergeDistance` for an internal (merge) node. */
  distance: number;
}

export interface DendrogramLink {
  /** The merge's own resulting cluster id (`n + row index`). */
  id: number;
  /** Elbow ("U") SVG path: up from one child to the merge height, across, down to the other. */
  path: string;
  distance: number;
  x: number;
  y: number;
}

export interface DendrogramLayoutResult {
  n: number;
  /** In `leafOrder` order (crossing-free per the backend's own ordering). */
  leaves: readonly DendrogramLeafPosition[];
  nodes: ReadonlyMap<number, DendrogramNodePosition>;
  /** Same order as the input `rows`. */
  links: readonly DendrogramLink[];
  maxDistance: number;
  /** Converts a merge distance (data units) into a pixel y: `height` at the leaves, `0` at the highest merge. */
  distanceToY: (distance: number) => number;
}

/**
 * Thrown for any linkage matrix that does not satisfy the TRD §6.4
 * conventions this layout depends on — never caught here, so a malformed
 * matrix fails loudly instead of being drawn incorrectly. Callers that must
 * degrade (e.g. `Dendrogram.tsx`) catch this explicitly and show an
 * accessible error instead of silently swallowing it.
 */
export class DendrogramLayoutError extends Error {}

function assertValidLeafOrder(leafOrder: readonly number[]): void {
  const n = leafOrder.length;
  const seen = new Set<number>();

  for (const id of leafOrder) {
    if (!Number.isInteger(id) || id < 0 || id >= n) {
      throw new DendrogramLayoutError(
        `leafOrder must contain only integers in [0, ${n - 1}]; got ${id}.`,
      );
    }
    if (seen.has(id)) {
      throw new DendrogramLayoutError(`leafOrder is not a permutation: duplicate id ${id}.`);
    }
    seen.add(id);
  }
}

function assertValidRows(rows: readonly DendrogramRow[], n: number): void {
  if (rows.length !== n - 1) {
    throw new DendrogramLayoutError(
      `expected exactly n - 1 = ${n - 1} rows for n = ${n} leaves; got ${rows.length}.`,
    );
  }

  rows.forEach((row, index) => {
    const maxValidId = n + index - 1;

    if (!Number.isInteger(row.idx1) || !Number.isInteger(row.idx2)) {
      throw new DendrogramLayoutError(`row ${index}: idx1/idx2 must be integers.`);
    }
    if (row.idx1 >= row.idx2) {
      throw new DendrogramLayoutError(
        `row ${index}: idx1 (${row.idx1}) must be strictly less than idx2 (${row.idx2}).`,
      );
    }
    if (row.idx1 < 0 || row.idx2 > maxValidId) {
      throw new DendrogramLayoutError(
        `row ${index}: idx1/idx2 must reference an already-created leaf or cluster ` +
          `(0..${maxValidId}); got (${row.idx1}, ${row.idx2}).`,
      );
    }
  });
}

export interface ComputeDendrogramLayoutInput {
  rows: readonly DendrogramRow[];
  leafOrder: readonly number[];
  width: number;
  height: number;
}

/**
 * Pure geometry over the backend's own linkage matrix (TRD §6.4): it never
 * recomputes a merge, only positions the `rows` and `leafOrder` it is given.
 * Throws `DendrogramLayoutError` on a malformed matrix (wrong row count, a
 * non-increasing or out-of-range `idx1`/`idx2`, or a `leafOrder` that is not
 * a permutation of `0..n-1`) instead of drawing something wrong.
 */
export function computeDendrogramLayout({
  rows,
  leafOrder,
  width,
  height,
}: ComputeDendrogramLayoutInput): DendrogramLayoutResult {
  const n = leafOrder.length;
  assertValidLeafOrder(leafOrder);
  assertValidRows(rows, n);

  const xScale = scaleLinear()
    .domain([0, n - 1])
    .range([0, width]);
  const leaves: DendrogramLeafPosition[] = leafOrder.map((id, index) => ({
    id,
    x: xScale(index),
  }));

  const maxDistance = rows.reduce((max, row) => Math.max(max, row.mergeDistance), 0);
  const yScale = scaleLinear()
    .domain([0, maxDistance || 1])
    .range([0, height]);
  const distanceToY = (distance: number): number =>
    maxDistance <= 0 ? height : height - yScale(distance);

  const nodes = new Map<number, DendrogramNodePosition>();
  for (const leaf of leaves) {
    nodes.set(leaf.id, { id: leaf.id, x: leaf.x, y: height, isLeaf: true, distance: 0 });
  }

  const links: DendrogramLink[] = [];
  for (const [index, row] of rows.entries()) {
    const clusterId = n + index;
    const child1 = nodes.get(row.idx1);
    const child2 = nodes.get(row.idx2);
    // assertValidRows already guarantees both ids were created by an earlier
    // leaf or row, so this can only fail if that guarantee itself has a bug.
    if (!child1 || !child2) {
      throw new DendrogramLayoutError(
        `row ${index}: idx1/idx2 do not reference an already-created leaf or cluster.`,
      );
    }

    const y = distanceToY(row.mergeDistance);
    const x = (child1.x + child2.x) / 2;
    nodes.set(clusterId, { id: clusterId, x, y, isLeaf: false, distance: row.mergeDistance });
    links.push({
      id: clusterId,
      distance: row.mergeDistance,
      x,
      y,
      path: `M ${child1.x} ${child1.y} V ${y} H ${child2.x} V ${child2.y}`,
    });
  }

  return { n, leaves, nodes, links, maxDistance, distanceToY };
}
