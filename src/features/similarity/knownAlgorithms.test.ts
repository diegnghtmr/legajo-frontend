import { describe, expect, it } from 'vitest';

import { AlgorithmIdSchema } from '../../infrastructure/schemas/similarity';
import { KNOWN_ALGORITHMS } from './knownAlgorithms';

describe('KNOWN_ALGORITHMS', () => {
  it('lists every fixed capability once, in the schema order', () => {
    expect(KNOWN_ALGORITHMS.map((algorithm) => algorithm.id)).toEqual(AlgorithmIdSchema.options);
  });

  it('marks the embedding capabilities as AI and the rest as classic', () => {
    const kinds = Object.fromEntries(KNOWN_ALGORITHMS.map((a) => [a.id, a.kind]));
    expect(kinds).toEqual({
      levenshtein: 'CLASSIC',
      'needleman-wunsch': 'CLASSIC',
      jaccard: 'CLASSIC',
      'tfidf-cosine': 'CLASSIC',
      'embedding-local': 'AI',
      'embedding-api': 'AI',
    });
  });
});
