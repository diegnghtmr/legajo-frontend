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

  it('marks the active option with the ink surface treatment', async () => {
    render(<ControlledToggleGroup />);

    expect(screen.getByRole('radio', { name: 'All' }).className).toContain('data-[state=on]');
  });
});
