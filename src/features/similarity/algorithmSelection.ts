import { AlgorithmIdSchema, type AlgorithmId } from '../../infrastructure/schemas/similarity';

/** The six fixed capability ids, independent of the catalogue fetch. */
export const DEFAULT_ALGORITHM_IDS: readonly AlgorithmId[] = AlgorithmIdSchema.options;

/** `null` (the param is absent) means "never touched" — default to every
 * algorithm. A present-but-empty value means "the person deselected every
 * algorithm", which must stay empty, never fall back to the default.
 * A repeated id collapses to its first occurrence — two rows for the same
 * algorithm would collide on that row's own DOM id, key and `aria-current`. */
export function parseAlgorithmIds(raw: string | null): AlgorithmId[] {
  if (raw === null) {
    return [...DEFAULT_ALGORITHM_IDS];
  }
  const known = new Set<string>(DEFAULT_ALGORITHM_IDS);
  const seen = new Set<string>();
  const ids: AlgorithmId[] = [];
  for (const id of raw.split(',')) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id as AlgorithmId);
    }
  }
  return ids;
}
