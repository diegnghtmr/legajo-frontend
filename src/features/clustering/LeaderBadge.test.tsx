import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeaderBadge } from './LeaderBadge';

describe('LeaderBadge', () => {
  it('shows the tree leader as an ink glyph block with the network icon and its label', () => {
    const { container } = render(<LeaderBadge kind="tree" />);

    const label = screen.getByText('Árbol');
    const badge = label.closest('[data-slot="leader-badge"]') as HTMLElement;
    expect(badge).not.toBeNull();
    const glyph = badge.querySelector('[data-slot="leader-glyph"]') as HTMLElement;
    expect(glyph.className).toContain('bg-ink');
    expect(glyph.className).toContain('text-primary-foreground');
    expect(glyph.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg.lucide-network')).not.toBeNull();
  });

  it('shows the partition leader with the layout-grid icon', () => {
    const { container } = render(<LeaderBadge kind="partition" />);

    expect(screen.getByText('Partición')).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-layout-grid')).not.toBeNull();
    expect(container.querySelector('svg.lucide-network')).toBeNull();
  });
});
