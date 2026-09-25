import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AlgoTextRadioGroup } from './AlgoTextRadioGroup';

const OPTIONS = [{ id: 'levenshtein' }, { id: 'jaccard' }, { id: 'embedding-api' }];

function ControlledGroup({ onChange }: { onChange?: (id: string) => void }) {
  const [value, setValue] = useState('levenshtein');

  return (
    <AlgoTextRadioGroup
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      aria-label="Matrix algorithm"
    />
  );
}

describe('AlgoTextRadioGroup', () => {
  it('renders a radiogroup with one radio per option, checking the active one', () => {
    render(<ControlledGroup />);

    const group = screen.getByRole('radiogroup', { name: 'Matrix algorithm' });
    expect(group).toBeInTheDocument();

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'levenshtein' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'jaccard' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'embedding-api' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('shows only the mono id text, with the active option styled ink + bottom border', () => {
    render(<ControlledGroup />);

    const active = screen.getByRole('radio', { name: 'levenshtein' });
    expect(active).toHaveTextContent(/^levenshtein$/);
    expect(active).toHaveClass('border-ink', 'text-ink');
    expect(screen.getByRole('radio', { name: 'jaccard' })).not.toHaveClass('border-ink');
  });

  it('uses roving tabindex: only the active option is a Tab stop', () => {
    render(<ControlledGroup />);

    expect(screen.getByRole('radio', { name: 'levenshtein' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'jaccard' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: 'embedding-api' })).toHaveAttribute('tabindex', '-1');
  });

  it('calls onChange with the clicked option id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledGroup onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'jaccard' }));

    expect(onChange).toHaveBeenCalledWith('jaccard');
  });

  it('moves selection forward with ArrowRight, wrapping past the last option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledGroup onChange={onChange} />);

    screen.getByRole('radio', { name: 'levenshtein' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('jaccard');
    expect(screen.getByRole('radio', { name: 'jaccard' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('embedding-api');

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('levenshtein');
    expect(screen.getByRole('radio', { name: 'levenshtein' })).toHaveFocus();
  });

  it('moves selection backward with ArrowLeft, wrapping before the first option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledGroup onChange={onChange} />);

    screen.getByRole('radio', { name: 'levenshtein' }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(onChange).toHaveBeenLastCalledWith('embedding-api');
    expect(screen.getByRole('radio', { name: 'embedding-api' })).toHaveFocus();
  });

  it('moves selection forward with ArrowDown, wrapping past the last option (WAI-ARIA radio group: Down behaves like Right)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledGroup onChange={onChange} />);

    screen.getByRole('radio', { name: 'levenshtein' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('jaccard');
    expect(screen.getByRole('radio', { name: 'jaccard' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('embedding-api');

    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('levenshtein');
    expect(screen.getByRole('radio', { name: 'levenshtein' })).toHaveFocus();
  });

  it('moves selection backward with ArrowUp, wrapping before the first option (WAI-ARIA radio group: Up behaves like Left)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledGroup onChange={onChange} />);

    screen.getByRole('radio', { name: 'levenshtein' }).focus();
    await user.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenLastCalledWith('embedding-api');
    expect(screen.getByRole('radio', { name: 'embedding-api' })).toHaveFocus();
  });

  it('jumps to the first option on Home and the last option on End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledGroup onChange={onChange} />);

    screen.getByRole('radio', { name: 'levenshtein' }).focus();
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('embedding-api');

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('levenshtein');
  });

  it('never selects on Tab-in alone', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledGroup onChange={onChange} />);

    await user.tab();

    expect(screen.getByRole('radio', { name: 'levenshtein' })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never selects on a plain programmatic focus() call', () => {
    const onChange = vi.fn();
    render(<ControlledGroup onChange={onChange} />);

    screen.getByRole('radio', { name: 'jaccard' }).focus();

    expect(screen.getByRole('radio', { name: 'jaccard' })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});
