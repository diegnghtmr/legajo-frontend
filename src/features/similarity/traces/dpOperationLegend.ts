/** The DP trace step operation kinds (TRD §6.3, contract `DpOperationKindSchema`). */
export type DpOperationKind =
  'MATCH' | 'SUBSTITUTION' | 'INSERTION' | 'DELETION' | 'MISMATCH' | 'GAP';

/**
 * The fixed per-algorithm operation vocabulary (PRD HU-1.2, DESIGN.md §6 item
 * 3): Levenshtein's backtrack only ever produces match/substitution/
 * insertion/deletion; Needleman–Wunsch's only ever produces match/mismatch/
 * gap. Declared statically (not derived from one trace's actual steps) so
 * the legend documents the algorithm's full vocabulary even when a short
 * path happens not to use every operation.
 */
export const DP_OPERATION_LEGEND: Record<
  'levenshtein' | 'needleman-wunsch',
  readonly DpOperationKind[]
> = {
  levenshtein: ['MATCH', 'SUBSTITUTION', 'INSERTION', 'DELETION'],
  'needleman-wunsch': ['MATCH', 'MISMATCH', 'GAP'],
};
