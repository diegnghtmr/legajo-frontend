import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import type { MatrixResponse } from '../../infrastructure/api/similarity';
import * as similarityApi from '../../infrastructure/api/similarity';
import { useSelectionStore } from '../corpus/selectionStore';
import { SimilarityMatrixPage } from './SimilarityMatrixPage';

vi.mock('../../infrastructure/api/corpus');
vi.mock('../../infrastructure/api/similarity');

const CORPUS_SUMMARIES = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['B. Two'] },
  { id: 'doc-03', title: 'Clustering theory refresher', authors: ['C. Three'] },
];

function matrixCell(normalizedScore: number) {
  return {
    normalizedScore,
    rawValue: normalizedScore,
    computedNanos: 100,
    cached: false,
    degenerate: false,
  };
}

const MATRIX_3X3: MatrixResponse = [
  [matrixCell(1), matrixCell(0.5), matrixCell(0.2)],
  [matrixCell(0.5), matrixCell(1), matrixCell(0.3)],
  [matrixCell(0.2), matrixCell(0.3), matrixCell(1)],
];

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
  vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS_SUMMARIES);
});

describe('SimilarityMatrixPage — fewer than 3 selected', () => {
  it.each([[[]], [['doc-01']], [['doc-01', 'doc-02']]])(
    'shows the wrong-count message and a link back to the corpus for selection %j',
    async (selectedIds) => {
      useSelectionStore.setState({
        selectedIds,
        canCompare: selectedIds.length >= 2,
        canMatrix: false,
      });
      vi.spyOn(similarityApi, 'fetchSimilarityMatrix');

      renderWithProviders(<SimilarityMatrixPage />);

      expect(
        await screen.findByText(
          `Tienes ${selectedIds.length} artículos seleccionados; selecciona al menos tres en el corpus para ver la matriz.`,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ir al corpus' })).toHaveAttribute('href', '/corpus');
      expect(similarityApi.fetchSimilarityMatrix).not.toHaveBeenCalled();
    },
  );
});

describe('SimilarityMatrixPage — 3 or more selected', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02', 'doc-03'],
      canCompare: true,
      canMatrix: true,
    });
  });

  it('requests the matrix with the selected ids and the default algorithm, rendering a 3x3 grid with diagonal 1.000', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityMatrix').mockResolvedValue(MATRIX_3X3);

    renderWithProviders(<SimilarityMatrixPage />);

    expect(await screen.findAllByText('1.000')).toHaveLength(3);

    expect(similarityApi.fetchSimilarityMatrix).toHaveBeenCalledWith({
      algorithmId: 'levenshtein',
      documentIds: ['doc-01', 'doc-02', 'doc-03'],
    });
  });

  it('re-requests the matrix with the new algorithm id when the selector changes', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityMatrix').mockResolvedValue(MATRIX_3X3);
    const user = userEvent.setup();

    renderWithProviders(<SimilarityMatrixPage />);

    await screen.findAllByText('1.000');
    await waitFor(() =>
      expect(similarityApi.fetchSimilarityMatrix).toHaveBeenLastCalledWith({
        algorithmId: 'levenshtein',
        documentIds: ['doc-01', 'doc-02', 'doc-03'],
      }),
    );

    const group = screen.getByRole('radiogroup', { name: 'Algoritmo de la matriz' });
    await user.click(within(group).getByRole('radio', { name: /jaccard/ }));

    await waitFor(() =>
      expect(similarityApi.fetchSimilarityMatrix).toHaveBeenLastCalledWith({
        algorithmId: 'jaccard',
        documentIds: ['doc-01', 'doc-02', 'doc-03'],
      }),
    );
  });

  it('shows a loading state while the matrix request is pending', async () => {
    let resolveMatrix: (value: MatrixResponse) => void = () => {};
    vi.spyOn(similarityApi, 'fetchSimilarityMatrix').mockReturnValue(
      new Promise((resolve) => {
        resolveMatrix = resolve;
      }),
    );

    renderWithProviders(<SimilarityMatrixPage />);

    expect(await screen.findByText('Calculando la matriz…')).toBeInTheDocument();
    resolveMatrix(MATRIX_3X3);
    await waitFor(() =>
      expect(screen.queryByText('Calculando la matriz…')).not.toBeInTheDocument(),
    );
  });

  it('shows the mapped error message when the matrix request fails', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityMatrix').mockRejectedValue({
      kind: 'problem',
      status: 400,
      type: 'urn:legajo:problem:invalid-selection',
      title: 'Bad Request',
      i18nKey: 'errors.invalidSelection',
    });

    renderWithProviders(<SimilarityMatrixPage />);

    expect(
      await screen.findByText(
        'La selección de documentos no es válida (se requieren al menos 3 sin duplicados).',
      ),
    ).toBeInTheDocument();
  });
});
