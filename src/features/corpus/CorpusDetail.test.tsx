import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';

vi.mock('../../infrastructure/api/corpus');

import { CorpusDetail } from './CorpusDetail';

function renderAt(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/corpus/${id}`]}>
        <Routes>
          <Route path="/corpus/:id" element={<CorpusDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CorpusDetail', () => {
  it('shows a loading state before the document query resolves', () => {
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockReturnValue(new Promise(() => {}));

    renderAt('doc-01');

    expect(screen.getByText('Cargando el artículo…')).toBeInTheDocument();
  });

  it('renders the title, authors and full abstract once loaded', async () => {
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockResolvedValue({
      id: 'doc-01',
      title: 'A study of similarity',
      authors: ['A. One', 'B. Two'],
      abstract: 'This is the full abstract text.',
    });

    renderAt('doc-01');

    expect(
      await screen.findByRole('heading', { name: 'A study of similarity' }),
    ).toBeInTheDocument();
    expect(screen.getByText('This is the full abstract text.')).toBeInTheDocument();
    expect(screen.getByText('A. One, B. Two')).toBeInTheDocument();
  });

  it('shows the mapped error message when the document is unknown', async () => {
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockRejectedValue({
      kind: 'problem',
      status: 404,
      type: 'urn:legajo:problem:unknown-document',
      title: 'Not found',
      i18nKey: 'errors.unknownDocument',
    });

    renderAt('doc-missing');

    expect(
      await screen.findByText('El documento solicitado no existe en el corpus.'),
    ).toBeInTheDocument();
  });
});
