import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NumberStepper, type NumberStepperProps } from './NumberStepper';

type Props = Partial<NumberStepperProps>;

function Harness({ initial = 3, ...props }: Props & { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      id="k"
      label="k: entre 2 y 5"
      min={2}
      max={5}
      decreaseLabel="Disminuir k"
      increaseLabel="Aumentar k"
      error="k debe ser un entero entre 2 y 5."
      {...props}
      value={value}
      onChange={(next) => {
        props.onChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe('NumberStepper', () => {
  it('renders a labelled integer field with the current value', () => {
    render(<Harness />);

    const field = screen.getByLabelText('k: entre 2 y 5');
    expect(field).toHaveValue(3);
    expect(field).toHaveAttribute('type', 'number');
    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(field).toHaveAttribute('min', '2');
    expect(field).toHaveAttribute('max', '5');
    expect(field).toHaveAttribute('aria-invalid', 'false');
  });

  it('steps by one with the labelled minus and plus buttons', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
    expect(onChange).toHaveBeenLastCalledWith(4);

    await user.click(screen.getByRole('button', { name: 'Disminuir k' }));
    await user.click(screen.getByRole('button', { name: 'Disminuir k' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('disables the minus button at the minimum and the plus button at the maximum', () => {
    const { rerender } = render(
      <NumberStepper
        id="k"
        label="k"
        min={2}
        max={5}
        value={2}
        onChange={() => {}}
        decreaseLabel="Disminuir k"
        increaseLabel="Aumentar k"
        error="mal"
      />,
    );
    expect(screen.getByRole('button', { name: 'Disminuir k' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar k' })).toBeEnabled();

    rerender(
      <NumberStepper
        id="k"
        label="k"
        min={2}
        max={5}
        value={5}
        onChange={() => {}}
        decreaseLabel="Disminuir k"
        increaseLabel="Aumentar k"
        error="mal"
      />,
    );
    expect(screen.getByRole('button', { name: 'Aumentar k' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disminuir k' })).toBeEnabled();
  });

  it('reports a typed value and marks an out-of-range one aria-invalid with a role="alert" error', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const field = screen.getByLabelText('k: entre 2 y 5');
    await user.clear(field);
    await user.type(field, '9');

    expect(field).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('k debe ser un entero entre 2 y 5.');
    expect(field).toHaveAccessibleDescription('k debe ser un entero entre 2 y 5.');
  });

  it('treats an empty field as invalid and reports NaN', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const field = screen.getByLabelText('k: entre 2 y 5');
    await user.clear(field);

    expect(onChange).toHaveBeenLastCalledWith(Number.NaN);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('treats a non-integer value as invalid', () => {
    render(<Harness initial={2.5} />);

    expect(screen.getByLabelText('k: entre 2 y 5')).toHaveAttribute('aria-invalid', 'true');
  });

  it('from an empty field, plus jumps to the minimum and minus stays disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={Number.NaN} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Disminuir k' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('shows the hint instead of the error while the value is valid', () => {
    render(<Harness hint="Entre 2 y 5" />);

    expect(screen.getByText('Entre 2 y 5')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders no slider by default', () => {
    render(<Harness />);

    expect(screen.queryByRole('slider', { hidden: true })).not.toBeInTheDocument();
  });

  it('offers an aria-hidden, unfocusable slider that mirrors and edits the value', () => {
    const onChange = vi.fn();
    const { container } = render(<Harness slider onChange={onChange} />);

    const slider = container.querySelector<HTMLInputElement>('input[type="range"]');
    expect(slider).not.toBeNull();
    expect(slider).toHaveAttribute('aria-hidden', 'true');
    expect(slider).toHaveAttribute('tabindex', '-1');
    expect(slider).toHaveValue('3');
    expect(slider).toHaveAttribute('min', '2');
    expect(slider).toHaveAttribute('max', '5');
  });

  it('places a trailing action on the field row, after the stepper', () => {
    render(<Harness trailing={<button type="button">Aplicar</button>} />);

    const field = screen.getByLabelText('k: entre 2 y 5');
    const action = screen.getByRole('button', { name: 'Aplicar' });
    expect(field.closest('div')?.parentElement).toContainElement(action);
  });

  it('wraps a long message inside the field column instead of widening it', () => {
    render(<Harness initial={9} />);

    expect(screen.getByRole('alert').className).toContain('w-0');
    expect(screen.getByRole('alert').className).toContain('min-w-full');
  });
});
