import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('joins truthy string values with a single space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values without leaving extra whitespace', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });

  it('includes object keys only when their value is truthy', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('resolves a later conflicting Tailwind utility over an earlier one for the same property', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('flattens arrays of class values', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });
});
