import { describe, expect, it } from 'vitest';

import { algoFamilyFromKind } from './algorithmFamily';

describe('algoFamilyFromKind', () => {
  it('maps the catalogue CLASSIC kind to the classic family', () => {
    expect(algoFamilyFromKind('CLASSIC')).toBe('classic');
  });

  it('maps the catalogue AI kind to the ai family', () => {
    expect(algoFamilyFromKind('AI')).toBe('ai');
  });
});
