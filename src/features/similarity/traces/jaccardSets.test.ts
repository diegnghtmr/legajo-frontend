import { describe, expect, it } from 'vitest';

import type { JaccardTrace } from '../../../infrastructure/schemas/similarity';
import { partitionJaccardSets } from './jaccardSets';

const TRACE: JaccardTrace = {
  algorithmId: 'jaccard',
  stemming: false,
  setA: ['zeta', 'alpha', 'shared-b', 'shared-a'],
  setB: ['omega', 'shared-a', 'beta', 'shared-b'],
  intersectionSize: 2,
  unionSize: 6,
  intersection: ['shared-a', 'shared-b'],
  union: ['alpha', 'beta', 'omega', 'shared-a', 'shared-b', 'zeta'],
  coefficient: 1 / 3,
};

describe('partitionJaccardSets', () => {
  it('splits the sets into only-A, both and only-B, each sorted alphabetically', () => {
    expect(partitionJaccardSets(TRACE)).toEqual({
      onlyA: ['alpha', 'zeta'],
      both: ['shared-a', 'shared-b'],
      onlyB: ['beta', 'omega'],
    });
  });

  it('gives three groups that together are exactly the union, with no token twice', () => {
    const { onlyA, both, onlyB } = partitionJaccardSets(TRACE);
    const together = [...onlyA, ...both, ...onlyB];

    expect(new Set(together).size).toBe(together.length);
    expect([...together].sort()).toEqual([...TRACE.union].sort());
  });

  it('gives empty groups for two empty sets', () => {
    expect(
      partitionJaccardSets({
        ...TRACE,
        setA: [],
        setB: [],
        intersection: [],
        union: [],
        intersectionSize: 0,
        unionSize: 0,
        coefficient: 1,
      }),
    ).toEqual({ onlyA: [], both: [], onlyB: [] });
  });
});
