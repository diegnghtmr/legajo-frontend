import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import * as embeddingsApi from '../../infrastructure/api/embeddings';
import { useSelectionStore } from './selectionStore';
import { SelectionRail } from './SelectionRail';

vi.mock('../../infrastructure/api/corpus');
vi.mock('../../infrastructure/api/embeddings');

const ARTICLES = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One', 'B. Two'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['C. Three'] },
  { id: 'doc-03', title: 'Clustering theory refresher', authors: ['D. Four'] },
];

const EMBEDDINGS_STATUS = {
  embeddingLocal: {
    provider: 'sentence-transformers',
    model: 'all-MiniLM-L6-v2',
    dimension: 384,
    corpusSha256: 'abc',
    matchesCorpus: true,
    device: 'cpu',
  },
  embeddingApi: {
    provider: 'google',
    model: 'gemini-embedding-2-preview',
    dimension: 1536,
    corpusSha256: 'abc',
    matchesCorpus: true,
    mode: 'cached' as const,
  },
};

function renderRail(overrides: Partial<Parameters<typeof SelectionRail>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenAbstract = vi.fn();
  const onOpenEmbeddings = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/similarity']}>
        <Routes>
          <Route
            path="/similarity"
            element={
              <SelectionRail
                onOpenAbstract={onOpenAbstract}
                onOpenEmbeddings={onOpenEmbeddings}
                {...overrides}
              />
            }
          />
          <Route path="/similarity/matrix" element={<p>matrix view</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onOpenAbstract, onOpenEmbeddings };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
  vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(ARTICLES);
  vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(EMBEDDINGS_STATUS);
});

/**
 * `SelectionRail` is now a thin composition of `CorpusListPanel` (its own
 * suite covers rows, search and the embeddings summary) and
 * `useAdaptiveSelectionCta` (its own suite covers every CTA label/enabled/
 * navigation case) around the rail's own pinned footer — so this suite only
 * covers that the two are actually wired together correctly, not every case
 * either already proves on its own.
 */
describe('SelectionRail', () => {
  it('renders the corpus list panel next to the pinned footer CTA', async () => {
    renderRail();

    expect(
      await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparar' })).toBeInTheDocument();
  });

  describe('the adaptive CTA', () => {
    it('is disabled with a reason below two selected', async () => {
      renderRail();
      await screen.findByRole('checkbox', { name: 'A survey of string similarity' });

      const button = screen.getByRole('button', { name: 'Comparar' });
      expect(button).toBeDisabled();
      expect(screen.getByText('Selecciona al menos 2 para comparar.')).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-describedby');
    });

    it('reads "Comparar dXX y dYY" and enables the CTA at exactly two selected', async () => {
      const user = userEvent.setup();
      renderRail();
      await user.click(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      );
      await user.click(screen.getByRole('checkbox', { name: 'Embeddings for scientific text' }));

      const button = screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' });
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute('aria-describedby');
    });

    it('reads "Ver matriz de N" and navigates to the matrix view at three or more selected', async () => {
      const user = userEvent.setup();
      renderRail();
      await user.click(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      );
      await user.click(screen.getByRole('checkbox', { name: 'Embeddings for scientific text' }));
      await user.click(screen.getByRole('checkbox', { name: 'Clustering theory refresher' }));

      const button = screen.getByRole('button', { name: 'Ver matriz de 3' });
      expect(button).toBeEnabled();

      await user.click(button);

      expect(await screen.findByText('matrix view')).toBeInTheDocument();
    });
  });
});
