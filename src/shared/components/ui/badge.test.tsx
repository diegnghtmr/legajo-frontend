import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>cached</Badge>);

    expect(screen.getByText('cached')).toBeInTheDocument();
  });

  it('uses the classic family color for the classic variant, never as page chrome', () => {
    render(<Badge variant="classic">Classic</Badge>);

    const badge = screen.getByText('Classic');
    expect(badge.className).toContain('bg-classic-soft');
    expect(badge.className).toContain('text-classic-foreground');
  });

  it('uses the ai family color for the ai variant, rendering different classes than classic or the untagged default', () => {
    // A plain `.toContain('ai')` does not discriminate: the default
    // variant's own `border-hairline-strong` class contains the substring
    // "ai" (h-[ai]rline), so that loose assertion would still pass even if
    // the `ai` variant silently fell back to `default`. Assert the exact
    // tokens instead, and that they differ from both other variants.
    render(
      <>
        <Badge>Default</Badge>
        <Badge variant="classic">Classic</Badge>
        <Badge variant="ai">AI</Badge>
      </>,
    );

    const defaultClassName = screen.getByText('Default').className;
    const classicClassName = screen.getByText('Classic').className;
    const aiClassName = screen.getByText('AI').className;

    expect(aiClassName).toContain('bg-ai-soft');
    expect(aiClassName).toContain('text-ai-foreground');
    expect(aiClassName).not.toContain('bg-classic-soft');
    expect(aiClassName).not.toContain('text-classic-foreground');
    expect(aiClassName).not.toBe(classicClassName);
    expect(aiClassName).not.toBe(defaultClassName);
  });

  it('renders the hatched marker variant as read-only mono text, never a family color', () => {
    render(<Badge variant="marker">aplicado</Badge>);

    const badge = screen.getByText('aplicado');
    expect(badge.className).toContain('font-mono');
    expect(badge.className).toContain('text-ink-secondary');
    expect(badge.className).toContain('repeating-linear-gradient');
    expect(badge.className).not.toContain('bg-classic-soft');
    expect(badge.className).not.toContain('bg-ai-soft');
  });
});
