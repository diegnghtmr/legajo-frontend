import { algoFamilyFromKind, type AlgorithmKind } from './algorithmFamily';

export type FamilyFilter = 'all' | 'classic' | 'ai';

/** The `family` search param, or `all` for anything missing or unknown. */
export function parseFamilyFilter(value: string | null): FamilyFilter {
  return value === 'classic' || value === 'ai' ? value : 'all';
}

/**
 * The view half of the family Segmented: keeps only the rows whose algorithm
 * belongs to the chosen family, in their original order. `all` keeps every
 * row. It never touches the selection or the request; an algorithm missing
 * from the catalogue reads as classic, like everywhere else.
 */
export function filterRowsByFamily<T extends { algorithmId: string }>(
  rows: readonly T[],
  family: FamilyFilter,
  catalogueById: ReadonlyMap<string, { kind: AlgorithmKind }>,
): T[] {
  if (family === 'all') {
    return [...rows];
  }
  return rows.filter(
    ({ algorithmId }) =>
      algoFamilyFromKind(catalogueById.get(algorithmId)?.kind ?? 'CLASSIC') === family,
  );
}
