import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

function ControlledCheckbox({ onChange }: { onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <Checkbox
      aria-label="Select article"
      checked={checked}
      onCheckedChange={(next) => {
        const isChecked = next === true;
        setChecked(isChecked);
        onChange?.(isChecked);
      }}
    />
  );
}

describe('Checkbox', () => {
  it('renders unchecked by default', () => {
    render(<Checkbox aria-label="Select article" />);

    expect(screen.getByRole('checkbox', { name: 'Select article' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('toggles to checked on click and calls onCheckedChange with true', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledCheckbox onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Select article' }));

    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('checkbox', { name: 'Select article' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('is keyboard operable with Space', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledCheckbox onChange={onChange} />);

    await user.tab();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
