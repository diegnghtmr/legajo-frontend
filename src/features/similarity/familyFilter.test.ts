import { describe, expect, it } from 'vitest';

import { filterRowsByFamily, parseFamilyFilter } from './familyFilter';

const CATALOGUE = new Map([
  ['levenshtein', { kind: 'CLASSIC' as const }],
  ['jaccard', { kind: 'CLASSIC' as const }],
  ['embedding-local', { kind: 'AI' as const }],
]);
const ROWS = [
  { algorithmId: 'levenshtein' },
  { algorithmId: 'embedding-local' },
  { algorithmId: 'jaccard' },
];

describe('parseFamilyFilter', () => {
  it('accepts the three known values and falls back to all', () => {
    expect(parseFamilyFilter('classic')).toBe('classic');
    expect(parseFamilyFilter('ai')).toBe('ai');
    expect(parseFamilyFilter('all')).toBe('all');
    expect(parseFamilyFilter('nonsense')).toBe('all');
    expect(parseFamilyFilter(null)).toBe('all');
  });
});

describe('filterRowsByFamily', () => {
  it('keeps every row under all', () => {
    expect(filterRowsByFamily(ROWS, 'all', CATALOGUE)).toEqual(ROWS);
  });

  it('keeps only the rows of the chosen family, in their original order', () => {
    expect(filterRowsByFamily(ROWS, 'classic', CATALOGUE).map((r) => r.algorithmId)).toEqual([
      'levenshtein',
      'jaccard',
    ]);
    expect(filterRowsByFamily(ROWS, 'ai', CATALOGUE).map((r) => r.algorithmId)).toEqual([
      'embedding-local',
    ]);
  });
});
