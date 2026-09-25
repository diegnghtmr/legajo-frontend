import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
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
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
}

/** Prints the router's live location as text, so a test can assert on the
 * URL a navigation actually produced without reaching into router
 * internals. Works anywhere inside the `MemoryRouter`, matched route or
 * not — `useLocation` is never scoped to a particular `Route`. */
function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

/** The same two routes `App.tsx` maps to `SimilarityPage` (the plain compare
 * view and the trace deep link), so a row's own `navigate` call is exercised
 * against real route matching instead of a router with nothing mounted. */
function renderAtRoute(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <Routes>
          <Route path="/similarity" element={<SimilarityPage />} />
          <Route path="/similarity/:algorithmId/trace" element={<SimilarityPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
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

  it.each([[[]], [['doc-01']], [['doc-01', 'doc-02', 'doc-03']]])(
    'never registers a compare query — not even a disabled one holding blank ids — for selection %j',
    (selectedIds) => {
      useSelectionStore.setState({
        selectedIds,
        canCompare: false,
        canMatrix: selectedIds.length >= 3,
      });

      const { queryClient } = renderWithProviders(<SimilarityPage />);

      // A disabled `useQuery` still registers its query key in the cache —
      // asserting on the cache (not just on whether the fetch ran) is what
      // proves the blank-id placeholders can no longer exist at all, rather
      // than merely being unused this render.
      expect(
        queryClient.getQueryCache().findAll({ queryKey: ['similarity', 'compare'] }),
      ).toHaveLength(0);
      expect(screen.queryByText(/Comparando/)).not.toBeInTheDocument();
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

    const { queryClient } = renderWithProviders(<SimilarityPage />);

    expect(await screen.findAllByRole('row')).toHaveLength(7); // header + 6 results

    expect(similarityApi.compareSimilarity).toHaveBeenCalledWith({
      documentIdA: 'doc-01',
      documentIdB: 'doc-02',
      algorithmIds: [...ALL_SIX_IDS],
    });

    // Exactly one compare query is ever registered for this pair — its key
    // carries the real sorted ids, never the blank-id placeholder shape.
    const compareQueries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['similarity', 'compare'] });
    expect(compareQueries).toHaveLength(1);
    expect(compareQueries[0]?.queryKey).toEqual([
      'similarity',
      'compare',
      'doc-01',
      'doc-02',
      [...ALL_SIX_IDS],
    ]);
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

  it('de-duplicates a repeated algorithm id from the URL, never rendering the same row twice', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      compareResponseFor(['levenshtein', 'jaccard']),
    );

    renderAtRoute('/similarity?algorithms=levenshtein%2Clevenshtein%2Cjaccard');

    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenCalledWith({
        documentIdA: 'doc-01',
        documentIdB: 'doc-02',
        algorithmIds: ['levenshtein', 'jaccard'],
      }),
    );
    // Header + exactly two result rows — a duplicated id never produces a
    // second row (which would collide on that row's own DOM id).
    expect(await screen.findAllByRole('row')).toHaveLength(3);
  });

  it('changes the compare request body when an algorithm button is toggled off', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(compareResponseFor(ALL_SIX_IDS));
    const user = userEvent.setup();

    renderWithProviders(<SimilarityPage />);

    // Scoped to the algorithm-selection group: once the table renders, each
    // result row carries its own same-named trace trigger button too.
    const algoGroup = await screen.findByRole('group', { name: 'Selección de algoritmos' });
    within(algoGroup).getByRole('button', { name: 'embedding-api' });
    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenLastCalledWith({
        documentIdA: 'doc-01',
        documentIdB: 'doc-02',
        algorithmIds: [...ALL_SIX_IDS],
      }),
    );

    await user.click(within(algoGroup).getByRole('button', { name: 'embedding-api' }));

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
    // Scoped to the algorithm-selection group: once the table renders, each
    // result row carries its own same-named trace trigger button too.
    const algoGroup = await screen.findByRole('group', { name: 'Selección de algoritmos' });
    within(algoGroup).getByRole('button', { name: 'embedding-api' });
    await waitFor(() => expect(similarityApi.compareSimilarity).toHaveBeenCalled());

    expect(ALL_SIX_IDS).toHaveLength(6);
    for (const id of ALL_SIX_IDS) {
      await user.click(within(algoGroup).getByRole('button', { name: id }));
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

  it('applies two search-param updates dispatched in the same tick without losing either', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(compareResponseFor(ALL_SIX_IDS));

    renderWithProviders(<SimilarityPage />);

    const algoGroup = await screen.findByRole('group', { name: 'Selección de algoritmos' });
    const embeddingApiButton = within(algoGroup).getByRole('button', { name: 'embedding-api' });
    const classicRadio = screen.getByRole('radio', { name: 'Clásico' });

    // Both dispatched synchronously inside one `act`, so React never
    // flushes a render between them — exactly the same-tick shape a real
    // double click, or two controls reacting to one shared event, produces.
    act(() => {
      fireEvent.click(classicRadio);
      fireEvent.click(embeddingApiButton);
    });

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
    expect(classicRadio).toHaveAttribute('aria-checked', 'true');
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

describe('SimilarityPage — the trace deep link route', () => {
  beforeEach(() => {
    // Explicit, rather than relying on the file-level `beforeEach` above:
    // several tests in this very describe block deliberately select
    // `doc-01`/`doc-02` in the rail, so a bare-deep-link test proving URL
    // precedence needs its own guaranteed-empty rail, not an inherited one
    // a later edit to the outer hook could silently weaken.
    useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(compareResponseFor(ALL_SIX_IDS));
  });

  it("reads the compared pair from the deep link's own document ids, even with nothing rail-selected", async () => {
    // Deliberately distinct from every other test's `doc-01`/`doc-02` pair:
    // that shared id would let a bug that quietly preferred the rail's own
    // (empty-here, but coincidentally identical) pair still pass.
    renderAtRoute('/similarity/levenshtein/trace?documentIdA=doc-05&documentIdB=doc-06');

    expect(await screen.findAllByRole('row')).toHaveLength(7);
    expect(similarityApi.compareSimilarity).toHaveBeenCalledWith({
      documentIdA: 'doc-05',
      documentIdB: 'doc-06',
      algorithmIds: [...ALL_SIX_IDS],
    });
  });

  it('marks the deep-linked algorithm’s row as the currently-open trace', async () => {
    renderAtRoute('/similarity/tfidf-cosine/trace?documentIdA=doc-01&documentIdB=doc-02');

    const row = await screen.findByRole('row', { name: /tfidf-cosine/i });
    expect(row).toHaveAttribute('aria-current', 'true');
  });

  it("normalizes a reversed deep-link pair into the same sorted order the rail's own pair uses", async () => {
    renderAtRoute('/similarity/levenshtein/trace?documentIdA=doc-02&documentIdB=doc-01');

    expect(await screen.findAllByRole('row')).toHaveLength(7);
    expect(similarityApi.compareSimilarity).toHaveBeenCalledWith({
      documentIdA: 'doc-01',
      documentIdB: 'doc-02',
      algorithmIds: [...ALL_SIX_IDS],
    });
  });

  it('treats a deep link naming the same document twice as no pair, showing the empty state', () => {
    renderAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-01');

    expect(
      screen.getByText(
        'Selecciona 2 artículos en el panel para comparar, o 3 o más para ver la matriz.',
      ),
    ).toBeInTheDocument();
    expect(similarityApi.compareSimilarity).not.toHaveBeenCalled();
  });

  it('follows the rail once it names a different, valid pair, instead of keeping the stale deep-linked comparison', async () => {
    renderAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(await screen.findAllByRole('row')).toHaveLength(7);
    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenLastCalledWith({
        documentIdA: 'doc-01',
        documentIdB: 'doc-02',
        algorithmIds: [...ALL_SIX_IDS],
      }),
    );

    // Picking an entirely different pair in the rail while the deep link is
    // still open — the comparison must follow the rail, not keep showing
    // the pair the link named.
    act(() => {
      useSelectionStore.setState({
        selectedIds: ['doc-03', 'doc-04'],
        canCompare: true,
        canMatrix: false,
      });
    });

    expect(await screen.findByText('Comparando doc-03 × doc-04')).toBeInTheDocument();
    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenLastCalledWith({
        documentIdA: 'doc-03',
        documentIdB: 'doc-04',
        algorithmIds: [...ALL_SIX_IDS],
      }),
    );
  });

  it("opens a row's trace by navigating to its deep link, preserving the family filter and algorithm selection already in the URL", async () => {
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02'],
      canCompare: true,
      canMatrix: false,
    });
    const user = userEvent.setup();

    renderAtRoute('/similarity?family=classic&algorithms=levenshtein%2Cjaccard');

    await screen.findByRole('group', { name: 'Selección de algoritmos' });
    // Only the two URL-selected algorithms were requested — proof the
    // selection itself (not only the family filter) came from the URL.
    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenCalledWith({
        documentIdA: 'doc-01',
        documentIdB: 'doc-02',
        algorithmIds: ['levenshtein', 'jaccard'],
      }),
    );

    // The row's own trigger, scoped to the results table so it is never
    // confused with the filter's same-named toggle button (that ambiguity
    // is exercised directly by CompareTable.test.tsx).
    const row = await screen.findByRole('row', { name: /^levenshtein/i });
    await user.click(within(row).getByRole('button', { name: 'levenshtein' }));

    const location = await screen.findByTestId('location');
    expect(location).toHaveTextContent('/similarity/levenshtein/trace');
    expect(location.textContent).toContain('documentIdA=doc-01');
    expect(location.textContent).toContain('documentIdB=doc-02');
    expect(location.textContent).toContain('family=classic');
    expect(location.textContent).toContain('algorithms=levenshtein%2Cjaccard');
  });

  it('keeps the family filter and algorithm selection when the compare view remounts after losing, then regaining, a valid pair', async () => {
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02'],
      canCompare: true,
      canMatrix: false,
    });

    renderAtRoute('/similarity?family=classic&algorithms=levenshtein');

    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenLastCalledWith({
        documentIdA: 'doc-01',
        documentIdB: 'doc-02',
        algorithmIds: ['levenshtein'],
      }),
    );

    // Losing the pair unmounts `SimilarityCompareView` entirely (the wrong-
    // count empty state renders instead) — a plain local `useState` would
    // be destroyed here.
    act(() => {
      useSelectionStore.setState({ selectedIds: ['doc-01'], canCompare: false, canMatrix: false });
    });
    expect(
      screen.getByText(
        'Selecciona 2 artículos en el panel para comparar, o 3 o más para ver la matriz.',
      ),
    ).toBeInTheDocument();

    act(() => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
    });

    await waitFor(() =>
      expect(similarityApi.compareSimilarity).toHaveBeenLastCalledWith({
        documentIdA: 'doc-01',
        documentIdB: 'doc-02',
        algorithmIds: ['levenshtein'],
      }),
    );
  });
});
