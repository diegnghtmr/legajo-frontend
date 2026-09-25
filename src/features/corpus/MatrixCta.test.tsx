import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSelectionStore } from './selectionStore';
import { MatrixCta } from './MatrixCta';

beforeEach(() => {
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

describe('MatrixCta', () => {
  it('is disabled and shows the "select at least three" reason with 0 selected', () => {
    render(
      <MemoryRouter>
        <MatrixCta />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Ver matriz' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('Selecciona al menos tres artículos para ver la matriz.'),
    ).toBeInTheDocument();
  });

  it('is disabled and shows the "select two more" reason with 1 selected', () => {
    useSelectionStore.getState().toggle('doc-01');

    render(
      <MemoryRouter>
        <MatrixCta />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Ver matriz' })).toBeDisabled();
    expect(
      screen.getByText('Selecciona dos artículos más para ver la matriz.'),
    ).toBeInTheDocument();
  });

  it('is disabled and shows the "select one more" reason with 2 selected', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');

    render(
      <MemoryRouter>
        <MatrixCta />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Ver matriz' })).toBeDisabled();
    expect(screen.getByText('Selecciona un artículo más para ver la matriz.')).toBeInTheDocument();
  });

  it('is enabled with no reason text at exactly 3 selected', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    useSelectionStore.getState().toggle('doc-03');

    render(
      <MemoryRouter>
        <MatrixCta />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Ver matriz' });
    expect(button).toBeEnabled();
    expect(
      screen.queryByText('Selecciona al menos tres artículos para ver la matriz.'),
    ).not.toBeInTheDocument();
  });

  it('opens the similarity matrix view when activated with three articles selected', async () => {
    const user = userEvent.setup();
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    useSelectionStore.getState().toggle('doc-03');
    render(
      <MemoryRouter initialEntries={['/corpus']}>
        <Routes>
          <Route path="/corpus" element={<MatrixCta />} />
          <Route path="/similarity/matrix" element={<p>matrix view</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Ver matriz' }));

    expect(screen.getByText('matrix view')).toBeInTheDocument();
  });

  it('does not submit a surrounding form when clicked', async () => {
    const user = userEvent.setup();
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    useSelectionStore.getState().toggle('doc-03');
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());

    render(
      <MemoryRouter>
        <form onSubmit={onSubmit}>
          <MatrixCta />
        </form>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Ver matriz' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
