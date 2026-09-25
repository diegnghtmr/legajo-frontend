import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ToggleGroup, ToggleGroupItem } from './toggle-group';

function ControlledToggleGroup({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('all');

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        setValue(next);
        onChange?.(next);
      }}
      aria-label="Family filter"
    >
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="classic">Classic</ToggleGroupItem>
      <ToggleGroupItem value="ai">AI</ToggleGroupItem>
    </ToggleGroup>
  );
}

describe('ToggleGroup (single) — Segmented primitive', () => {
  it('exposes a radiogroup of radio options, checking the active one', () => {
    render(<ControlledToggleGroup />);

    expect(screen.getByRole('radiogroup', { name: 'Family filter' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onValueChange with the clicked option value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledToggleGroup onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Classic' }));

    expect(onChange).toHaveBeenCalledWith('classic');
  });

  it('marks the active option with the ink surface treatment via the data-state attribute', async () => {
    render(<ControlledToggleGroup />);

    expect(screen.getByRole('radio', { name: 'All' }).className).toContain('data-[state=on]');
  });

  it('flips data-state and aria-checked from the clicked option onto the newly active one', async () => {
    const user = userEvent.setup();
    render(<ControlledToggleGroup />);

    await user.click(screen.getByRole('radio', { name: 'Classic' }));

    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('data-state', 'off');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'false');
  });

  it('moves focus (not selection) on ArrowRight, then selects the focused option on Space', async () => {
    // The raw primitive's arrow keys only move the roving-tabindex focus —
    // they do not also select, unlike a native <input type="radio"> group.
    // `SegmentedControl` adds that "select follows focus" behavior itself
    // (see its own test suite); this test pins the raw primitive's actual,
    // narrower keyboard contract so the two are not confused.
    const user = userEvent.setup();
    render(<ControlledToggleGroup />);

    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('data-state', 'off');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('data-state', 'on');

    await user.keyboard(' ');

    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('data-state', 'off');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'false');
  });

  it('grows each option to a 44px touch target on coarse pointers without resizing on desktop', () => {
    render(<ControlledToggleGroup />);

    const option = screen.getByRole('radio', { name: 'All' });
    expect(option.className).toContain('pointer-coarse:min-h-11');
    expect(option.className).toContain('pointer-coarse:min-w-11');
  });

  it('shows a visible focus ring only on keyboard focus, in the ink/focus token', () => {
    render(<ControlledToggleGroup />);

    expect(screen.getByRole('radio', { name: 'All' }).className).toContain(
      'focus-visible:outline-ring',
    );
  });

  it('marks a disabled option to assistive tech and stops it from firing onValueChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ToggleGroup type="single" value="all" onValueChange={onChange} aria-label="Family filter">
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="classic" disabled>
          Classic
        </ToggleGroupItem>
      </ToggleGroup>,
    );

    const option = screen.getByRole('radio', { name: 'Classic' });
    expect(option).toBeDisabled();
    expect(option.className).toContain('disabled:opacity-45');

    await user.click(option);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('only transitions colors when the user has not requested reduced motion', () => {
    render(<ControlledToggleGroup />);

    expect(screen.getByRole('radio', { name: 'All' }).className).toContain(
      'motion-safe:transition-colors',
    );
  });
});
