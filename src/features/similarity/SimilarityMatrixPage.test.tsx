import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import type { MatrixResponse } from '../../infrastructure/api/similarity';
import * as similarityApi from '../../infrastructure/api/similarity';
import { useSelectionStore } from '../corpus/selectionStore';
import { SimilarityMatrixPage } from './SimilarityMatrixPage';
import { SimilarityPage } from './SimilarityPage';

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

/** Prints the router's live location, so a test can prove the URL actually
 * changed (or stayed put) without reaching into router internals. */
function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

/** The same two routes `App.tsx` maps to the plain compare path and the
 * matrix deep link, so a redirect away from one is exercised against real
 * route matching — proving the pair actually keeps rendering (now via
 * `SimilarityPage`) across the hand-off, not just that the URL changed. */
function renderAtRoute(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <Routes>
          <Route path="/similarity" element={<SimilarityPage />} />
          <Route path="/similarity/matrix" element={<SimilarityMatrixPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
  vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS_SUMMARIES);
});

describe('SimilarityMatrixPage — fewer than 2 selected', () => {
  it.each([[[]], [['doc-01']]])(
    'shows a designed empty state naming the next step for selection %j',
    async (selectedIds) => {
      useSelectionStore.setState({
        selectedIds,
        canCompare: selectedIds.length >= 2,
        canMatrix: false,
      });
      vi.spyOn(similarityApi, 'fetchSimilarityMatrix');

      renderWithProviders(<SimilarityMatrixPage />);

      const status = await screen.findByText(
        'Selecciona 2 artículos en el panel para comparar, o 3 o más para ver la matriz.',
      );
      expect(status).toBeInTheDocument();
      // A designed state: the message lives inside the Panel card (a
      // `<section>`), never a bare "go to the corpus" dead end — the
      // persistent rail already lets the user change the selection.
      expect(status.closest('section')).not.toBeNull();
      expect(screen.queryByRole('link', { name: /corpus/i })).not.toBeInTheDocument();
      expect(similarityApi.fetchSimilarityMatrix).not.toHaveBeenCalled();
    },
  );
});

describe('SimilarityMatrixPage — exactly two selected (dropped below three while on this deep link)', () => {
  it('normalizes the URL to plain /similarity and shows the pairwise view there, never a stale /similarity/matrix', async () => {
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02'],
      canCompare: true,
      canMatrix: false,
    });
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue([
      { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
    ]);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue([
      {
        algorithmId: 'levenshtein',
        result: {
          normalizedScore: 0.5,
          rawValue: 1,
          computedNanos: 100,
          cached: false,
          degenerate: false,
        },
      },
    ]);

    renderAtRoute('/similarity/matrix');

    // The redirect hands off from `SimilarityMatrixPage` to `SimilarityPage`
    // (real route matching, `renderAtRoute`'s own doc comment) — the pair
    // keeps rendering across that hand-off, never a dead end.
    expect(
      await screen.findByRole('heading', { name: 'doc-01 frente a doc-02' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Matriz de similitud' })).not.toBeInTheDocument();
    const location = await screen.findByTestId('location');
    await waitFor(() => expect(location.textContent).toBe('/similarity'));
  });

  it('preserves the URL search params through the redirect, never dropping them', async () => {
    useSelectionStore.setState({
      selectedIds: ['doc-01'],
      canCompare: false,
      canMatrix: false,
    });

    renderAtRoute('/similarity/matrix?lang=en');

    const location = await screen.findByTestId('location');
    await waitFor(() => expect(location.textContent).toBe('/similarity?lang=en'));
  });
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

  it('shows a hidden loading status while the matrix request is pending', async () => {
    let resolveMatrix: (value: MatrixResponse) => void = () => {};
    vi.spyOn(similarityApi, 'fetchSimilarityMatrix').mockReturnValue(
      new Promise((resolve) => {
        resolveMatrix = resolve;
      }),
    );

    renderWithProviders(<SimilarityMatrixPage />);

    const status = await screen.findByText('Calculando la matriz…');
    expect(status).toHaveAttribute('role', 'status');
    expect(status.className).toContain('sr-only');
    resolveMatrix(MATRIX_3X3);
    await waitFor(() =>
      expect(screen.queryByText('Calculando la matriz…')).not.toBeInTheDocument(),
    );
  });

  it('shows a 3x3 skeleton grid, one row/column per selected document, while the matrix request is pending', () => {
    vi.spyOn(similarityApi, 'fetchSimilarityMatrix').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<SimilarityMatrixPage />);

    const skeleton = screen.getByTestId('matrix-skeleton');
    // 3 selected documents: a header row of 3 column headers plus 3 body
    // rows of 3 cells each — never a guess at some other, unrelated count.
    expect(skeleton.querySelectorAll('th[scope="col"]')).toHaveLength(1 + 3);
    expect(skeleton.querySelectorAll('th[scope="row"]')).toHaveLength(3);
    expect(skeleton.querySelectorAll('td')).toHaveLength(9);
    // The same scroll-region semantics the real table's own wrapper carries
    // (`MatrixTable`), so the swap changes no box and no landmark.
    expect(skeleton).toHaveAttribute('role', 'region');
    expect(skeleton).toHaveAttribute('tabIndex', '0');
    expect(skeleton).toHaveAccessibleName(
      'Matriz de similitud por pares para el algoritmo elegido',
    );
    // Every column/row header still carries real accessible content (never
    // an empty `<th>`, axe's `empty-table-header`): the corner's own
    // sr-only label, and a sr-only fallback next to each decorative bar.
    for (const header of skeleton.querySelectorAll('th')) {
      expect(header.textContent?.trim()).not.toBe('');
    }
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
