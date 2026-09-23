import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CutForm } from './CutForm';

const LINKAGES = [
  { id: 'single' as const, displayName: 'Single' },
  { id: 'complete' as const, displayName: 'Complete' },
  { id: 'average' as const, displayName: 'Average' },
  { id: 'ward' as const, displayName: 'Ward' },
];

function renderForm(overrides: Partial<React.ComponentProps<typeof CutForm>> = {}) {
  const onSubmit = vi.fn();
  const utils = render(
    <CutForm
      linkages={LINKAGES}
      n={6}
      defaultLinkage="single"
      onSubmit={onSubmit}
      isPending={false}
      {...overrides}
    />,
  );
  return { onSubmit, ...utils };
}

async function setK(user: ReturnType<typeof userEvent.setup>, value: string) {
  const input = screen.getByLabelText(/Número de clústeres k/);
  await user.clear(input);
  if (value) {
    await user.type(input, value);
  }
}

describe('CutForm', () => {
  it('renders one segmented option per requested linkage, defaulting to defaultLinkage', () => {
    renderForm({ defaultLinkage: 'complete' });

    const group = screen.getByRole('radiogroup', { name: 'Enlace a cortar' });
    expect(within(group).getByRole('radio', { name: 'Complete' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(group).getByRole('radio', { name: 'Single' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('rejects k = 1 (below the minimum) and does not submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await setK(user, '1');
    await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('k debe ser un entero entre 2 y 5.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects k = n (above the maximum, n - 1) and does not submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ n: 6 });

    await setK(user, '6');
    await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('k debe ser un entero entre 2 y 5.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts the minimum allowed k (2) and submits {linkage, k}', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ defaultLinkage: 'average' });

    await setK(user, '2');
    await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

    expect(onSubmit).toHaveBeenCalledWith({ linkage: 'average', k: 2 });
  });

  it('accepts the maximum allowed k (n - 1) and submits {linkage, k}', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ n: 6 });

    await setK(user, '5');
    await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

    expect(onSubmit).toHaveBeenCalledWith({ linkage: 'single', k: 5 });
  });

  it('submits the linkage selected via the radiogroup, not always the default', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const group = screen.getByRole('radiogroup', { name: 'Enlace a cortar' });
    await user.click(within(group).getByRole('radio', { name: 'Ward' }));
    await setK(user, '3');
    await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

    expect(onSubmit).toHaveBeenCalledWith({ linkage: 'ward', k: 3 });
  });

  it('disables the submit button while a cut is pending', () => {
    renderForm({ isPending: true });

    expect(screen.getByRole('button', { name: 'Aplicando el corte…' })).toBeDisabled();
  });

  it('shows the mapped API error message when a cut request failed', () => {
    renderForm({
      error: { kind: 'unexpected', i18nKey: 'errors.invalidCut', message: 'boom' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'El valor de corte k no es válido para este corpus.',
    );
  });

  it('disables the form and shows a reason when n - 1 < 2 (no valid k for n = 2)', () => {
    renderForm({ n: 2 });

    expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeDisabled();
    expect(screen.queryByLabelText(/Número de clústeres k/)).not.toBeInTheDocument();
    expect(
      screen.getByText('No hay una cantidad de clústeres válida para cortar este corpus.'),
    ).toBeInTheDocument();
  });

  it('still offers a valid single-value range when n - 1 === 2 (n = 3)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ n: 3 });

    expect(
      screen.queryByText('No hay una cantidad de clústeres válida para cortar este corpus.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar corte' })).not.toBeDisabled();

    await setK(user, '2');
    await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

    expect(onSubmit).toHaveBeenCalledWith({ linkage: 'single', k: 2 });
  });
});
