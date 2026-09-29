import type { JaccardTrace } from '../../../infrastructure/schemas/similarity';

export interface JaccardPartition {
  /** In set A only. */
  onlyA: string[];
  /** In both sets: the intersection as sent. */
  both: string[];
  /** In set B only. */
  onlyB: string[];
}

function sorted(tokens: Iterable<string>): string[] {
  return [...tokens].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Reads a Jaccard trace as a partition of its union: what only A has, what
 * both have and what only B has, each alphabetically. Nothing is re-tokenised
 * or added; the three groups are made from the sets exactly as the backend
 * sent them, so together they are the union.
 */
export function partitionJaccardSets(trace: JaccardTrace): JaccardPartition {
  const inA = new Set(trace.setA);
  const inB = new Set(trace.setB);
  return {
    onlyA: sorted(trace.setA.filter((token) => !inB.has(token))),
    both: sorted(trace.intersection),
    onlyB: sorted(trace.setB.filter((token) => !inA.has(token))),
  };
}
