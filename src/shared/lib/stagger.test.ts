import { describe, expect, it } from 'vitest';

import { MAX_STAGGER_INDEX, staggerStyle } from './stagger';

describe('staggerStyle', () => {
  it('sets the entry index on the element', () => {
    expect(staggerStyle(3)).toEqual({ '--i': 3 });
  });

  it('caps the index so a long list never waits on its tail', () => {
    expect(staggerStyle(500)).toEqual({ '--i': MAX_STAGGER_INDEX });
    expect(MAX_STAGGER_INDEX).toBe(12);
  });
});
