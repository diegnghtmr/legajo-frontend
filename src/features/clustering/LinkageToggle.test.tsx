import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LinkageToggle, LinkageToggleGroup } from './LinkageToggle';

describe('LinkageToggle', () => {
  it('is a toggle button named by its mono id, pressed only while selected', () => {
    const { rerender } = render(<LinkageToggle id="ward" selected={false} onToggle={() => {}} />);

    const button = screen.getByRole('button', { name: 'ward' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(within(button).getByText('ward')).toHaveClass('font-mono');

    rerender(<LinkageToggle id="ward" selected onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'ward' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('draws a selected box with an ink border and an ink checkbox holding a check', () => {
    render(<LinkageToggle id="single" selected onToggle={() => {}} />);

    const button = screen.getByRole('button', { name: 'single' });
    expect(button).toHaveClass('border-ink', 'text-ink', 'bg-paper-raised', 'rounded-btn', 'h-9');
    const glyph = button.querySelector('[data-tick]');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(glyph).toHaveClass('size-4', 'border-primary', 'bg-primary');
    expect(glyph?.querySelector('svg')).not.toBeNull();
  });

  it('draws an unselected box with a hairline-strong border, secondary text and an empty checkbox', () => {
    render(<LinkageToggle id="single" selected={false} onToggle={() => {}} />);

    const button = screen.getByRole('button', { name: 'single' });
    expect(button).toHaveClass('border-hairline-strong', 'text-ink-secondary');
    expect(button).not.toHaveClass('border-ink');
    const glyph = button.querySelector('[data-tick]');
    expect(glyph).toHaveClass('border-hairline-strong');
    expect(glyph?.querySelector('svg')).toBeNull();
  });

  it('keeps a 44px hit area on a coarse pointer', () => {
    render(<LinkageToggle id="single" selected onToggle={() => {}} />);

    expect(screen.getByRole('button', { name: 'single' })).toHaveClass('pointer-coarse:min-h-11');
  });

  it('reports a click', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<LinkageToggle id="average" selected={false} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'average' }));

    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe('LinkageToggleGroup', () => {
  const IDS = ['single', 'complete', 'average', 'ward'] as const;

  it('lays the toggles in four equal columns from 640px and two below, 8px apart', () => {
    render(
      <LinkageToggleGroup ids={IDS} selectedIds={IDS} onToggle={() => {}} aria-label="Enlaces" />,
    );

    const group = screen.getByRole('group', { name: 'Enlaces' });
    expect(group).toHaveClass('grid', 'grid-cols-2', 'min-[640px]:grid-cols-4', 'gap-2');
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([...IDS]);
  });

  it('marks exactly the selected ids as pressed and reports the toggled id', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <LinkageToggleGroup
        ids={IDS}
        selectedIds={['single', 'ward']}
        onToggle={onToggle}
        aria-label="Enlaces"
      />,
    );

    expect(screen.getByRole('button', { name: 'single' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'complete' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'complete' }));
    expect(onToggle).toHaveBeenCalledWith('complete');
  });
});
