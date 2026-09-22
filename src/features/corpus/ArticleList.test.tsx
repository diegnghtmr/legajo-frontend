import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import { useSelectionStore } from './selectionStore';

vi.mock('../../infrastructure/api/corpus');

import { ArticleList } from './ArticleList';

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

describe('ArticleList', () => {
  it('shows a loading state before the query resolves', () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<ArticleList />);

    expect(screen.getByText('Cargando el corpus…')).toBeInTheDocument();
  });

  it('renders one row per corpus article once loaded', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
      { id: 'doc-01', title: 'First article', authors: ['A. One'] },
      { id: 'doc-02', title: 'Second article', authors: ['B. Two'] },
    ]);

    renderWithProviders(<ArticleList />);

    expect(await screen.findByRole('link', { name: 'First article' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Second article' })).toBeInTheDocument();
  });

  it('shows an empty state when the corpus has no articles', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([]);

    renderWithProviders(<ArticleList />);

    expect(await screen.findByText('El corpus no tiene artículos cargados.')).toBeInTheDocument();
  });

  it('shows the mapped error message when the query rejects with a network error', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockRejectedValue({
      kind: 'network',
      cause: 'timeout',
      i18nKey: 'errors.network.coldStart',
    });

    renderWithProviders(<ArticleList />);

    expect(
      await screen.findByText(
        'No se pudo contactar al servidor. Si es la primera solicitud en un rato, el servidor gratuito puede estar despertando: puede tardar hasta un minuto en responder.',
      ),
    ).toBeInTheDocument();
  });

  it('toggles selection in the shared store when a row checkbox is clicked', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
      { id: 'doc-01', title: 'First article', authors: ['A. One'] },
    ]);
    const user = userEvent.setup();

    renderWithProviders(<ArticleList />);

    const checkbox = await screen.findByRole('checkbox', { name: 'First article' });
    await user.click(checkbox);

    expect(useSelectionStore.getState().selectedIds).toEqual(['doc-01']);
  });
});
