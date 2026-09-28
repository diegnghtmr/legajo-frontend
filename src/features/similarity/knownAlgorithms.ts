import type { ListSimilarityAlgorithmsResponse } from '../../infrastructure/api/similarity';

/**
 * The six fixed capabilities with the display name and kind the catalogue
 * endpoint publishes for them. Only the loading skeleton reads this, to draw
 * the ids, names and families while the catalogue request is still in flight
 * so the placeholder takes the same box the resolved content will; every
 * real screen keeps reading the fetched catalogue.
 */
export const KNOWN_ALGORITHMS: ListSimilarityAlgorithmsResponse = [
  { id: 'levenshtein', displayName: 'Levenshtein', kind: 'CLASSIC' },
  { id: 'needleman-wunsch', displayName: 'Needleman-Wunsch', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard', kind: 'CLASSIC' },
  { id: 'tfidf-cosine', displayName: 'TF-IDF Cosine', kind: 'CLASSIC' },
  { id: 'embedding-local', displayName: 'Embedding (MiniLM local)', kind: 'AI' },
  { id: 'embedding-api', displayName: 'Embedding (Gemini API)', kind: 'AI' },
];
