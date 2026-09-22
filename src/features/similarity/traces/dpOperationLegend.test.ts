import { describe, expect, it } from 'vitest';

import { DP_OPERATION_LEGEND } from './dpOperationLegend';

describe('DP_OPERATION_LEGEND', () => {
  it("lists Levenshtein's vocabulary: match, substitution, insertion, deletion", () => {
    expect(DP_OPERATION_LEGEND.levenshtein).toEqual([
      'MATCH',
      'SUBSTITUTION',
      'INSERTION',
      'DELETION',
    ]);
  });

  it("lists Needleman–Wunsch's vocabulary: match, mismatch, gap", () => {
    expect(DP_OPERATION_LEGEND['needleman-wunsch']).toEqual(['MATCH', 'MISMATCH', 'GAP']);
  });

  it('the legend changes by algorithm (the two vocabularies are not the same)', () => {
    expect(DP_OPERATION_LEGEND.levenshtein).not.toEqual(DP_OPERATION_LEGEND['needleman-wunsch']);
  });
});
