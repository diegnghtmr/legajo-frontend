import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import { useSelectionStore } from './selectionStore';

vi.mock('../../infrastructure/api/corpus');

import { CorpusDetail } from './CorpusDetail';
import { CorpusDetailPlaceholder } from './CorpusDetailPlaceholder';
import { CorpusPage } from './CorpusPage';

function renderCorpusRoutes(initialPath = '/corpus') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/corpus" element={<CorpusPage />}>
            <Route index element={<CorpusDetailPlaceholder />} />
            <Route path=":id" element={<CorpusDetail />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

describe('CorpusPage', () => {
  it('renders the corpus title, the article list and the select-an-article prompt by default', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
      { id: 'doc-01', title: 'First article', authors: ['A. One'] },
    ]);

    renderCorpusRoutes();

    expect(screen.getByRole('heading', { name: 'Artículos del corpus' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'First article' })).toBeInTheDocument();
    expect(
      screen.getByText('Selecciona un artículo para ver su resumen completo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ver matriz' })).toBeDisabled();
  });

  it('navigating to an article shows its detail next to the still-visible list', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
      { id: 'doc-01', title: 'First article', authors: ['A. One'] },
    ]);
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockResolvedValue({
      id: 'doc-01',
      title: 'First article',
      authors: ['A. One'],
      abstract: 'The full abstract.',
    });
    const user = userEvent.setup();

    renderCorpusRoutes();

    await user.click(await screen.findByRole('link', { name: 'First article' }));

    expect(await screen.findByText('The full abstract.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'First article' })).toBeInTheDocument();
  });
});
