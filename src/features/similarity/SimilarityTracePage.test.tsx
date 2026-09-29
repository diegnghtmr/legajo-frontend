import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as similarityApi from '../../infrastructure/api/similarity';
import type { ListSimilarityAlgorithmsResponse } from '../../infrastructure/api/similarity';
import type {
  DpMatrixTrace,
  EmbeddingApiTrace,
  EmbeddingLocalTrace,
  JaccardTrace,
  TfIdfCosineTrace,
} from '../../infrastructure/schemas/similarity';
import { useSelectionStore } from '../corpus/selectionStore';
import { SimilarityTracePage } from './SimilarityTracePage';

vi.mock('../../infrastructure/api/similarity');

/** Same catalogue shape `SimilarityPage.test.tsx` and the e2e fixtures use. */
const CATALOGUE: ListSimilarityAlgorithmsResponse = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'needleman-wunsch', displayName: 'Needleman–Wunsch', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
  { id: 'tfidf-cosine', displayName: 'TF-IDF cosine', kind: 'CLASSIC' },
  { id: 'embedding-local', displayName: 'Local embedding', kind: 'AI' },
  { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' },
];

const DP_TRACE: DpMatrixTrace = {
  algorithmId: 'levenshtein',
  rowLabels: ['k', 'i', 't'],
  columnLabels: ['s', 'i', 't'],
  matrix: [
    [0, 1, 2, 3],
    [1, 1, 2, 3],
    [2, 2, 1, 2],
    [3, 3, 2, 1],
  ],
  optimalPath: [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
    { row: 3, col: 3 },
  ],
  operations: [{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 }, operation: 'SUBSTITUTION' }],
};

const JACCARD_TRACE: JaccardTrace = {
  algorithmId: 'jaccard',
  setA: ['a', 'b'],
  setB: ['b', 'c'],
  intersectionSize: 1,
  unionSize: 3,
  intersection: ['b'],
  union: ['a', 'b', 'c'],
  coefficient: 0.3333,
};

const TFIDF_TRACE: TfIdfCosineTrace = {
  algorithmId: 'tfidf-cosine',
  corpusSize: 20,
  terms: [],
  dotProduct: 0.5,
  rawNormA: 1,
  rawNormB: 1,
  cosine: 0.5,
  angleDegrees: 60,
};

const EMBEDDING_LOCAL_TRACE: EmbeddingLocalTrace = {
  algorithmId: 'embedding-local',
  provider: 'sentence-transformers',
  model: 'all-MiniLM-L6-v2',
  dimension: 384,
  vectorAExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorBExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorA: [],
  vectorB: [],
  preNormL2A: 1,
  preNormL2B: 1,
  dotProduct: 0.9,
  cosine: 0.9,
  angleDegrees: 25,
  normalizedScore: 0.9,
};

const EMBEDDING_API_TRACE: EmbeddingApiTrace = {
  algorithmId: 'embedding-api',
  provider: 'google',
  model: 'gemini-embedding-2-preview',
  dimension: 1536,
  vectorAExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorBExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorA: [],
  vectorB: [],
  preNormL2A: 1,
  preNormL2B: 1,
  sumSquaredDiff: 0.2,
  distance: 0.4472,
  normalizedScore: 0.68,
  providerStatus: 'cached',
};

/** Prints the router's live location as text, so a test can assert on the
 * URL a navigation actually produced without reaching into router
 * internals — the same helper `SimilarityPage.test.tsx` uses for the same
 * reason. */
function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderAtRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/similarity" element={<p>{'Plain compare screen'}</p>} />
          <Route path="/similarity/:algorithmId/trace" element={<SimilarityTracePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ROUTE = '/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02';

describe('SimilarityTracePage', () => {
  beforeEach(() => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
  });

  it('shows a loading state before the trace resolves', () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockReturnValue(new Promise(() => {}));

    renderAtRoute(ROUTE);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando la traza');
  });

  it('shows the result block skeleton with the trace skeleton while everything is pending', () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    renderAtRoute(ROUTE);

    expect(screen.getByTestId('trace-result-block-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('trace-body-skeleton')).toBeInTheDocument();
  });

  it('shows the result block above the trace, from the compare results', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockImplementation(async ({ algorithmIds }) =>
      (algorithmIds ?? []).map((algorithmId) => ({
        algorithmId,
        result: {
          normalizedScore: 0.75,
          rawValue: 12,
          computedNanos: 100,
          cached: false,
          degenerate: false,
        },
      })),
    );

    renderAtRoute('/similarity/jaccard/trace?documentIdA=doc-01&documentIdB=doc-02');

    const block = await screen.findByRole('region', { name: 'Resultado' });
    expect(within(block).getByText('0.750')).toBeInTheDocument();
    const trace = await screen.findByText('|S_A ∩ S_B| / |S_A ∪ S_B| = 1 / 3 = 0.333300');
    expect(block.compareDocumentPosition(trace) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('renders the DP panel for a DP trace (matrix cells present)', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);

    renderAtRoute(ROUTE);

    const cells = await screen.findAllByRole('cell');
    expect(cells.length).toBeGreaterThan(0);
    expect(similarityApi.fetchSimilarityTrace).toHaveBeenCalledWith({
      algorithmId: 'levenshtein',
      documentIdA: 'doc-01',
      documentIdB: 'doc-02',
    });
  });

  it('renders the Jaccard panel for a Jaccard trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);

    renderAtRoute('/similarity/jaccard/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(
      await screen.findByText('|S_A ∩ S_B| / |S_A ∪ S_B| = 1 / 3 = 0.333300'),
    ).toBeInTheDocument();
  });

  it('renders the TF-IDF panel for a TF-IDF trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(TFIDF_TRACE);

    renderAtRoute('/similarity/tfidf-cosine/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(await screen.findByText('20')).toBeInTheDocument();
  });

  it('renders the embedding-local panel for an embedding-local trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(EMBEDDING_LOCAL_TRACE);

    renderAtRoute('/similarity/embedding-local/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(await screen.findByTestId('embedding-local-model')).toHaveTextContent(
      'all-MiniLM-L6-v2',
    );
  });

  it('renders the embedding-api panel for an embedding-api trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(EMBEDDING_API_TRACE);

    renderAtRoute('/similarity/embedding-api/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(await screen.findByTestId('embedding-api-providerStatus')).toHaveTextContent('cached');
  });

  it('shows the mapped i18n error message for a 404 unknown-algorithm rejection', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockRejectedValue({
      kind: 'problem',
      status: 404,
      type: 'urn:legajo:problem:unknown-algorithm',
      title: 'Not found',
      i18nKey: 'errors.unknownAlgorithm',
    });

    renderAtRoute('/similarity/not-an-algorithm/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(
      await screen.findByText('El algoritmo de similitud solicitado no existe.'),
    ).toBeInTheDocument();
  });

  it('shows the mapped i18n error message for a 400 unknown-document rejection', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockRejectedValue({
      kind: 'problem',
      status: 400,
      type: 'urn:legajo:problem:unknown-document',
      title: 'Bad request',
      i18nKey: 'errors.unknownDocument',
    });

    renderAtRoute('/similarity/levenshtein/trace?documentIdA=missing&documentIdB=doc-02');

    expect(
      await screen.findByText('El documento solicitado no existe en el corpus.'),
    ).toBeInTheDocument();
  });

  it('has a back link that returns to this same trace in the workbench, keeping the compared pair', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);

    renderAtRoute('/similarity/jaccard/trace?documentIdA=doc-01&documentIdB=doc-02');

    await screen.findByText('|S_A ∩ S_B| / |S_A ∪ S_B| = 1 / 3 = 0.333300');
    // Never a bare `/similarity`: that would land on an unselected rail
    // and lose the pair this same view is already showing.
    expect(screen.getByRole('link', { name: 'Volver a la comparación' })).toHaveAttribute(
      'href',
      '/similarity/jaccard/trace?documentIdA=doc-01&documentIdB=doc-02',
    );
  });

  it('falls back to a bare /similarity back link when a document id is missing from the URL', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockRejectedValue({
      kind: 'problem',
      status: 400,
      type: 'urn:legajo:problem:unknown-document',
      title: 'Bad request',
      i18nKey: 'errors.unknownDocument',
    });

    renderAtRoute('/similarity/jaccard/trace?documentIdA=doc-01');

    await screen.findByText('El documento solicitado no existe en el corpus.');
    expect(screen.getByRole('link', { name: 'Volver a la comparación' })).toHaveAttribute(
      'href',
      '/similarity',
    );
  });

  it('titles the page with the algorithm display name, not a repeat of the eyebrow', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);

    renderAtRoute('/similarity/jaccard/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(await screen.findByRole('heading', { name: 'Jaccard index' })).toBeInTheDocument();
  });

  it('shows a subtitle naming the two compared documents', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);

    renderAtRoute('/similarity/jaccard/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(await screen.findByText('doc-01 frente a doc-02')).toBeInTheDocument();
  });

  it('shows the family and optimal-path-cost meta row for a DP trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);

    renderAtRoute(ROUTE);

    expect(await screen.findByTestId('dp-trace-family')).toHaveTextContent('Clásico');
    // DP_TRACE's matrix bottom-right cell (the edit distance itself).
    expect(screen.getByTestId('dp-trace-optimal-path')).toHaveTextContent('1');
  });

  it('shows a designed, retryable error when the algorithm catalogue rejects, without hiding an already-resolved trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockRejectedValue({
      kind: 'network',
      cause: 'timeout',
      i18nKey: 'errors.network.coldStart',
    });
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);

    renderAtRoute(ROUTE);

    // The trace itself resolved: its matrix still renders.
    expect((await screen.findAllByRole('cell')).length).toBeGreaterThan(0);
    // The meta row that depends on the catalogue never silently disappears:
    // a designed, visible error replaces it, with a retry action.
    expect(screen.queryByTestId('dp-trace-family')).not.toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo cargar los datos del algoritmo');
    expect(alert).toHaveAttribute('data-slot', 'alert');
    // The retry action sits in the alert's own footer.
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    // The title falls back to the plain id (never a repeat of the eyebrow),
    // exactly as it already does before the catalogue resolves.
    expect(screen.getByRole('heading', { name: 'levenshtein' })).toBeInTheDocument();
  });

  it('retries the algorithm catalogue fetch when the retry action is activated', async () => {
    const user = userEvent.setup();
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms')
      .mockRejectedValueOnce({
        kind: 'network',
        cause: 'timeout',
        i18nKey: 'errors.network.coldStart',
      })
      .mockResolvedValueOnce(CATALOGUE);
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);

    renderAtRoute(ROUTE);

    await screen.findByRole('button', { name: 'Reintentar' });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByTestId('dp-trace-family')).toHaveTextContent('Clásico');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('omits the subtitle instead of rendering a raw placeholder when a document id is missing from the URL', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);

    renderAtRoute('/similarity/jaccard/trace?documentIdA=doc-01');

    await screen.findByText('|S_A ∩ S_B| / |S_A ∪ S_B| = 1 / 3 = 0.333300');
    expect(screen.queryByText(/frente a/)).not.toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  describe('following the rail once it has been touched', () => {
    it('leaves the full view for plain /similarity once the rail names a different, valid pair', async () => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
      vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);

      renderAtRoute(ROUTE);

      await screen.findByRole('heading', { name: 'Levenshtein distance' });

      // Picking an entirely different pair in the rail while the full view
      // is still open for doc-01/doc-02 — never kept open for the new pair,
      // unlike the docked trace route's own "different pair" case.
      act(() => {
        useSelectionStore.setState({
          selectedIds: ['doc-03', 'doc-04'],
          canCompare: true,
          canMatrix: false,
        });
      });

      const location = await screen.findByTestId('location');
      await waitFor(() => expect(location.textContent).not.toContain('/trace'));
      expect(location).toHaveTextContent('/similarity');
      expect(location.textContent).not.toContain('documentIdA');
      expect(location.textContent).not.toContain('documentIdB');
    });

    it('drops the stale full view once the rail shrinks below a pair (deselecting one article, never a genuinely new pair)', async () => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
      vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);

      renderAtRoute(ROUTE);

      await screen.findByRole('heading', { name: 'Levenshtein distance' });

      act(() => {
        useSelectionStore.setState({
          selectedIds: ['doc-01'],
          canCompare: false,
          canMatrix: false,
        });
      });

      const location = await screen.findByTestId('location');
      await waitFor(() => expect(location.textContent).not.toContain('/trace'));
      expect(location).toHaveTextContent('/similarity');
    });

    it('drops the stale full view once the rail is cleared to nothing (Limpiar), never keeping the old pair on screen', async () => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
      vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);

      renderAtRoute(ROUTE);

      await screen.findByRole('heading', { name: 'Levenshtein distance' });

      act(() => {
        useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
      });

      const location = await screen.findByTestId('location');
      await waitFor(() => expect(location.textContent).not.toContain('/trace'));
      expect(location).toHaveTextContent('/similarity');
    });

    it('never redirects a cold visit whose rail is still empty — the deep link keeps resolving normally', async () => {
      vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);

      renderAtRoute(ROUTE);

      expect(
        await screen.findByRole('heading', { name: 'Levenshtein distance' }),
      ).toBeInTheDocument();
      const location = await screen.findByTestId('location');
      expect(location.textContent).toContain('/trace');
    });
  });
});
