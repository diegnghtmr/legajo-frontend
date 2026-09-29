import { describe, expect, it } from 'vitest';

import type { CompareResponse } from '../../infrastructure/api/similarity';
import { rankResults } from './traceRanking';

function row(algorithmId: string, normalizedScore: number): CompareResponse[number] {
  return {
    algorithmId,
    result: { normalizedScore, rawValue: 1, computedNanos: 1, cached: false, degenerate: false },
  } as CompareResponse[number];
}

describe('rankResults', () => {
  it('sorts by normalized score, highest first, numbering from 1', () => {
    const ranked = rankResults([
      row('jaccard', 0.4),
      row('levenshtein', 0.9),
      row('embedding-api', 0.6),
    ]);
    expect(ranked.map(({ algorithmId, rank }) => [algorithmId, rank])).toEqual([
      ['levenshtein', 1],
      ['embedding-api', 2],
      ['jaccard', 3],
    ]);
  });

  it('gives tied scores the better rank and skips the next number', () => {
    const ranked = rankResults([
      row('jaccard', 0.5),
      row('levenshtein', 0.9),
      row('embedding-api', 0.5),
      row('tfidf-cosine', 0.1),
    ]);
    expect(ranked.map(({ algorithmId, rank }) => [algorithmId, rank])).toEqual([
      ['levenshtein', 1],
      ['jaccard', 2],
      ['embedding-api', 2],
      ['tfidf-cosine', 4],
    ]);
  });

  it('keeps the response order among tied scores', () => {
    const ranked = rankResults([row('b', 0.5), row('a', 0.5)]);
    expect(ranked.map(({ algorithmId }) => algorithmId)).toEqual(['b', 'a']);
  });

  it('returns nothing for no rows', () => {
    expect(rankResults([])).toEqual([]);
  });
});
