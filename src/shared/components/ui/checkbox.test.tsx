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

  it('extends its hit area to 44px on coarse pointers via an invisible pseudo-element, keeping the 16px visible box', () => {
    render(<Checkbox aria-label="Select article" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Select article' });
    expect(checkbox.className).toContain('size-4');
    expect(checkbox.className).toContain('pointer-coarse:before:inset-[-14px]');
  });

  it('shows a visible focus ring only on keyboard focus, in the ink/focus token', () => {
    render(<Checkbox aria-label="Select article" />);

    expect(screen.getByRole('checkbox', { name: 'Select article' }).className).toContain(
      'focus-visible:outline-ring',
    );
  });

  it('marks the disabled state to assistive tech via the native disabled attribute', () => {
    render(<Checkbox aria-label="Select article" disabled />);

    const checkbox = screen.getByRole('checkbox', { name: 'Select article' });
    expect(checkbox).toBeDisabled();
    expect(checkbox.className).toContain('disabled:opacity-45');
  });

  it('only transitions colors when the user has not requested reduced motion', () => {
    render(<Checkbox aria-label="Select article" />);

    expect(screen.getByRole('checkbox', { name: 'Select article' }).className).toContain(
      'motion-safe:transition-colors',
    );
  });
});
