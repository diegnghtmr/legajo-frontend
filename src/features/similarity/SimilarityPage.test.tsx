import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import * as similarityApi from '../../infrastructure/api/similarity';
import type { AlgorithmId } from '../../infrastructure/schemas/similarity';
import { useSelectionStore } from '../corpus/selectionStore';
import { SimilarityPage } from './SimilarityPage';

vi.mock('../../infrastructure/api/similarity');

const ALL_SIX_IDS: readonly AlgorithmId[] = [
  'levenshtein',
  'needleman-wunsch',
  'jaccard',
  'tfidf-cosine',
  'embedding-local',
  'embedding-api',
];

const CATALOGUE: ListSimilarityAlgorithmsResponse = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'needleman-wunsch', displayName: 'Needleman–Wunsch', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
  { id: 'tfidf-cosine', displayName: 'TF-IDF cosine', kind: 'CLASSIC' },
  { id: 'embedding-local', displayName: 'Local embedding', kind: 'AI' },
  { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' },
];

function compareResponseFor(ids: readonly AlgorithmId[]): CompareResponse {
  return ids.map((algorithmId) => ({
    algorithmId,
    result: {
      normalizedScore: 0.5,
      rawValue: 1,
      computedNanos: 100,
      cached: false,
      degenerate: false,
    },
  }));
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // `vi.restoreAllMocks()` alone leaves an already-automocked export's call
  // history intact across tests in this file (spyOn on an existing mock has
  // no separate "original" to restore to), so `clearAllMocks` resets it too.
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

describe('SimilarityPage — wrong selection count', () => {
  it.each([[[]], [['doc-01']], [['doc-01', 'doc-02', 'doc-03']]])(
    'shows a designed empty state naming the next step for selection %j',
    (selectedIds) => {
      useSelectionStore.setState({ selectedIds, canCompare: false, canMatrix: false });

      renderWithProviders(<SimilarityPage />);

      const status = screen.getByText(
        'Selecciona 2 artículos en el panel para comparar, o 3 o más para ver la matriz.',
      );
      expect(status).toBeInTheDocument();
      // A designed empty state: the message lives inside the Panel card
      // (a `<section>`), never a bare "go to the corpus" dead end — the
      // persistent rail already lets the user change the selection.
      expect(status.closest('section')).not.toBeNull();
      expect(screen.queryByRole('link', { name: /corpus/i })).not.toBeInTheDocument();
      expect(similarityApi.compareSimilarity).not.toHaveBeenCalled();
    },
  );
});

describe('SimilarityPage — three or more selected (wrong count for compare, matrix eligible)', () => {
  it('shows a link to the similarity matrix in addition to the empty-state message', () => {
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02', 'doc-03'],
      canCompare: false,
      canMatrix: true,
    });

    renderWithProviders(<SimilarityPage />);

    expect(
      screen.getByText(
        'Selecciona 2 artículos en el panel para comparar, o 3 o más para ver la matriz.',
      ),
    ).toBeInTheDocument();
    const matrixLink = screen.getByRole('link', { name: 'Ver la matriz de similitud' });
    expect(matrixLink).toHaveAttribute('href', '/similarity/matrix');
    expect(matrixLink.className).toContain('border-hairline-strong');
  });

  it('does not show the matrix link with fewer than 3 selected', () => {
    useSelectionStore.setState({
      selectedIds: ['doc-01'],
      canCompare: false,
      canMatrix: false,
    });

    renderWithProviders(<SimilarityPage />);

    expect(
      screen.queryByRole('link', { name: 'Ver la matriz de similitud' }),
    ).not.toBeInTheDocument();
  });
});

describe('SimilarityPage — exactly two selected', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02'],
      canCompare: true,
      canMatrix: false,
    });
  });

  it('requests all six algorithms by default and renders the six-row table', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(compareResponseFor(ALL_SIX_IDS));

    renderWithProviders(<SimilarityPage />);

    expect(await screen.findAllByRole('row')).toHaveLength(7); // header + 6 results

    expect(similarityApi.compareSimilarity).toHaveBeenCalledWith({
      documentIdA: 'doc-01',
      documentIdB: 'doc-02',
      algorithmIds: [...ALL_SIX_IDS],
    });
  });

  it('narrows the visible algorithm buttons by family without changing the underlying selection', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(compareResponseFor(ALL_SIX_IDS));
    const user = userEvent.setup();

    renderWithProviders(<SimilarityPage />);

    const algoGroup = await screen.findByRole('group', { name: 'Selección de algoritmos' });
    expect(within(algoGroup).getByRole('button', { name: 'embedding-api' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('radio', { name: 'Clásico' }));

    expect(
      within(algoGroup).queryByRole('button', { name: 'embedding-api' }),
    ).not.toBeInTheDocument();
    expect(within(algoGroup).getByRole('button', { name: 'levenshtein' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Todos' }));

    expect(within(algoGroup).getByRole('button', { name: 'embedding-api' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('changes the compare request body when an algorithm button is toggled off', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(compareResponseFor(ALL_SIX_IDS));
    const user = userEvent.setup();

    renderWithProviders(<SimilarityPage />);

    await screen.findByRole('button', { name: 'embedding-api' });
    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenLastCalledWith({
        documentIdA: 'doc-01',
        documentIdB: 'doc-02',
        algorithmIds: [...ALL_SIX_IDS],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'embedding-api' }));

    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenLastCalledWith({
        documentIdA: 'doc-01',
        documentIdB: 'doc-02',
        algorithmIds: [
          'levenshtein',
          'needleman-wunsch',
          'jaccard',
          'tfidf-cosine',
          'embedding-local',
        ],
      }),
    );
  });

  it('with every algorithm deselected, shows the reason and sends no further compare request', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(compareResponseFor(ALL_SIX_IDS));
    const user = userEvent.setup();

    renderWithProviders(<SimilarityPage />);
    await screen.findByRole('button', { name: 'embedding-api' });
    await waitFor(() => expect(similarityApi.compareSimilarity).toHaveBeenCalled());

    expect(ALL_SIX_IDS).toHaveLength(6);
    for (const id of ALL_SIX_IDS) {
      await user.click(screen.getByRole('button', { name: id }));
    }
    const callsWithNoSelection = vi.mocked(similarityApi.compareSimilarity).mock.calls.length;

    expect(
      await screen.findByText('Selecciona al menos un algoritmo para comparar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(vi.mocked(similarityApi.compareSimilarity).mock.calls.length).toBe(callsWithNoSelection);
    expect(
      vi
        .mocked(similarityApi.compareSimilarity)
        .mock.calls.some(([request]) => request.algorithmIds?.length === 0),
    ).toBe(false);
  });

  it('shows the mapped error message when the algorithm catalogue fails to load', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockRejectedValue({
      kind: 'network',
      cause: 'timeout',
      i18nKey: 'errors.network.coldStart',
    });
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(compareResponseFor(ALL_SIX_IDS));

    renderWithProviders(<SimilarityPage />);

    expect(
      await screen.findByText(
        'No se pudo contactar al servidor. Si es la primera solicitud en un rato, el servidor gratuito puede estar despertando: puede tardar hasta un minuto en responder.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the mapped error message when the compare request fails', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockRejectedValue({
      kind: 'unexpected',
      i18nKey: 'errors.unexpected',
      message: 'boom',
    });

    renderWithProviders(<SimilarityPage />);

    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
  });
});
