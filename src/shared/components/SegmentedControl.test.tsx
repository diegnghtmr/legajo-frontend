import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

type Family = 'all' | 'classic' | 'ai';

const OPTIONS = [
  { value: 'all' as Family, label: 'All' },
  { value: 'classic' as Family, label: 'Classic' },
  { value: 'ai' as Family, label: 'AI' },
];

function ControlledSegmented({ onChange }: { onChange?: (value: Family) => void }) {
  const [value, setValue] = useState<Family>('all');

  return (
    <SegmentedControl
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      aria-label="Family filter"
    />
  );
}

describe('SegmentedControl', () => {
  it('renders a radiogroup with a radio option per value, checking the active one', () => {
    render(<ControlledSegmented />);

    const group = screen.getByRole('radiogroup', { name: 'Family filter' });
    expect(group).toBeInTheDocument();

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'AI' })).toHaveAttribute('aria-checked', 'false');
  });

  it('uses roving tabindex: one Tab stop enters the group and lands focus on the active option', async () => {
    // Radix's roving-focus group is an "entry point" model: before any
    // interaction the group root itself holds the single Tab stop
    // (tabindex 0 on the root, every item at -1); Tab redirects focus to the
    // current item, which is when its own tabindex flips to 0 and its
    // siblings' stay at -1. This is a stronger, WAI-ARIA-compliant proof
    // than asserting a static attribute before any interaction, which was
    // only true for the previous hand-rolled implementation.
    const user = userEvent.setup();
    render(<ControlledSegmented />);

    await user.tab();

    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: 'AI' })).toHaveAttribute('tabindex', '-1');
  });

  it('calls onChange with the clicked option value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSegmented onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Classic' }));

    expect(onChange).toHaveBeenCalledWith('classic');
  });

  it('moves selection forward with ArrowRight, wrapping past the last option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSegmented onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('classic');
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('ai');

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('all');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();
  });

  it('moves selection backward with ArrowLeft, wrapping before the first option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSegmented onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await user.keyboard('{ArrowLeft}');

    expect(onChange).toHaveBeenLastCalledWith('ai');
    expect(screen.getByRole('radio', { name: 'AI' })).toHaveFocus();
  });

  it('keeps the group keyboard-reachable when the value matches no option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={OPTIONS}
        value={'stale' as Family}
        onChange={onChange}
        aria-label="Family filter"
      />,
    );

    // With no matching value, Radix's roving-focus group defaults its entry
    // point to the first item, so one Tab still reaches "All" before moving on.
    await user.tab();
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();
    // Entering the group by Tab must never select anything by itself, with
    // no matching value either: onChange fires only for an explicit key
    // press or click, never merely because a roving-focus default landed
    // focus somewhere.
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('classic');
  });

  it('accepts a rich node as an option label, keeping the accessible name from its text', () => {
    render(
      <SegmentedControl
        options={[
          { value: 'all' as Family, label: <span className="font-mono">all</span> },
          { value: 'classic' as Family, label: <span className="font-mono">classic</span> },
        ]}
        value={'all' as Family}
        onChange={() => {}}
        aria-label="Mono filter"
      />,
    );

    const option = screen.getByRole('radio', { name: 'all' });
    expect(option.querySelector('span.font-mono')).toBeInTheDocument();
  });

  it('never selects on Tab-in alone when the value matches an option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSegmented onChange={onChange} />);

    await user.tab();

    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never selects on Tab-in alone when the value matches no option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={OPTIONS}
        value={'stale' as Family}
        onChange={onChange}
        aria-label="Family filter"
      />,
    );

    await user.tab();

    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never selects on a plain programmatic focus() call', () => {
    const onChange = vi.fn();
    render(<ControlledSegmented onChange={onChange} />);

    screen.getByRole('radio', { name: 'Classic' }).focus();

    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects with ArrowRight exactly once, with only the next value, after a non-selecting Tab-in', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSegmented onChange={onChange} />);

    await user.tab();
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('classic');
  });

  it('jumps to the first option on Home and the last option on End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSegmented onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Classic' }));

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('ai');
    expect(screen.getByRole('radio', { name: 'AI' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('all');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();
  });
});
