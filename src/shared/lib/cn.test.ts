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

  // The project's @theme (src/index.css) defines custom font-size tokens —
  // --text-display, --text-title, --text-body, --text-label, --text-eyebrow,
  // --text-mono, --text-formula. tailwind-merge's default config only knows
  // Tailwind's own size suffixes (xs, sm, base, lg, ...), so an unregistered
  // custom size collides with its generic text-color group instead: a size
  // combined with a real color silently loses the size. Every one of these
  // tokens must survive next to a color class.
  const CUSTOM_FONT_SIZE_TOKENS = [
    'display',
    'title',
    'body',
    'label',
    'eyebrow',
    'mono',
    'formula',
  ] as const;

  it.each(CUSTOM_FONT_SIZE_TOKENS)(
    'keeps both a custom text-%s size and a text color, in call order',
    (size) => {
      expect(cn(`text-${size}`, 'text-ink')).toBe(`text-${size} text-ink`);
    },
  );

  it('keeps only the last of two conflicting custom font sizes', () => {
    expect(cn('text-label', 'text-title')).toBe('text-title');
  });

  it('keeps only the last of two conflicting text colors', () => {
    expect(cn('text-ink', 'text-ink-secondary')).toBe('text-ink-secondary');
  });

  // The @theme radius scale adds one non-standard suffix, `--radius-btn`
  // (rounded-btn), alongside standard ones (none/sm/md/lg/full) that
  // tailwind-merge already recognizes. Unregistered, `rounded-btn` would not
  // be treated as a radius utility at all, so it would never lose to — or
  // win over — another `rounded-*` class.
  it('keeps only the last of two conflicting radii, including the custom rounded-btn', () => {
    expect(cn('rounded-md', 'rounded-btn')).toBe('rounded-btn');
    expect(cn('rounded-btn', 'rounded-md')).toBe('rounded-md');
  });
});
