import { describe, expect, it } from 'vitest';

import { shortenHash } from './shortenHash';

describe('shortenHash', () => {
  it('shortens a real sha256 hex digest to a readable prefix…suffix form', () => {
    const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85';

    expect(shortenHash(sha256)).toBe('e3b0c442…852b85');
  });

  it('leaves a string at the exact boundary length unchanged', () => {
    // VISIBLE_PREFIX (8) + VISIBLE_SUFFIX (6) + 1 = 15: shortening a string
    // this short would not save any characters, so it is returned verbatim.
    const boundary = 'a'.repeat(15);

    expect(shortenHash(boundary)).toBe(boundary);
  });

  it('shortens a string one character past the boundary length', () => {
    const pastBoundary = 'b'.repeat(16);

    expect(shortenHash(pastBoundary)).toBe('bbbbbbbb…bbbbbb');
  });

  it('returns an empty string unchanged', () => {
    expect(shortenHash('')).toBe('');
  });
});
