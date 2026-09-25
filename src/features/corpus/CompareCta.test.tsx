import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSelectionStore } from './selectionStore';
import { CompareCta } from './CompareCta';

beforeEach(() => {
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

describe('CompareCta', () => {
  it('is disabled and shows the "select two" reason with 0 selected', () => {
    render(
      <MemoryRouter>
        <CompareCta />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('Selecciona al menos dos artículos para comparar.'),
    ).toBeInTheDocument();
  });

  it('is disabled and shows the "select one more" reason with 1 selected', () => {
    useSelectionStore.getState().toggle('doc-01');

    render(
      <MemoryRouter>
        <CompareCta />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Selecciona un artículo más para comparar.')).toBeInTheDocument();
  });

  it('is enabled with no reason text at exactly 2 selected', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');

    render(
      <MemoryRouter>
        <CompareCta />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button).toBeEnabled();
    expect(
      screen.queryByText('Selecciona al menos dos artículos para comparar.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Selecciona un artículo más para comparar.')).not.toBeInTheDocument();
  });

  it('stays enabled above 2 selected', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    useSelectionStore.getState().toggle('doc-03');

    render(
      <MemoryRouter>
        <CompareCta />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Comparar' })).toBeEnabled();
  });
  it('opens the similarity view when activated with two articles selected', async () => {
    const user = userEvent.setup();
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    render(
      <MemoryRouter initialEntries={['/corpus']}>
        <Routes>
          <Route path="/corpus" element={<CompareCta />} />
          <Route path="/similarity" element={<p>similarity view</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Comparar' }));

    expect(screen.getByText('similarity view')).toBeInTheDocument();
  });

  it('does not submit a surrounding form when clicked', async () => {
    const user = userEvent.setup();
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());

    render(
      <MemoryRouter>
        <form onSubmit={onSubmit}>
          <CompareCta />
        </form>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Comparar' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
