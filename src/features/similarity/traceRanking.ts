import type { CompareResponse } from '../../infrastructure/api/similarity';

export interface RankedResult {
  algorithmId: string;
  normalizedScore: number;
  /** 1-based; tied scores share the better rank and the next number is skipped. */
  rank: number;
}

/**
 * Presentation only: orders the compare rows the screen already holds by their
 * backend `normalizedScore`, highest first. The rank is a reading of that
 * order, never a value the backend returns or the client computes from
 * documents.
 */
export function rankResults(rows: CompareResponse): RankedResult[] {
  return rows
    .map(({ algorithmId, result }) => ({ algorithmId, normalizedScore: result.normalizedScore }))
    .sort((a, b) => b.normalizedScore - a.normalizedScore)
    .map((entry, _index, sorted) => ({
      ...entry,
      rank:
        1 + sorted.filter(({ normalizedScore }) => normalizedScore > entry.normalizedScore).length,
    }));
}
