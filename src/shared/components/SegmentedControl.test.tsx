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

  it('uses roving tabindex: only the active option is tab-reachable', () => {
    render(<ControlledSegmented />);

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
