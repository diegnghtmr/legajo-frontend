import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import * as embeddingsApi from '../../infrastructure/api/embeddings';
import * as similarityApi from '../../infrastructure/api/similarity';
import type { ListSimilarityAlgorithmsResponse } from '../../infrastructure/api/similarity';
import type { DpMatrixTrace } from '../../infrastructure/schemas/similarity';
import { useSelectionStore } from '../corpus/selectionStore';
import { SimilarityPage } from './SimilarityPage';
import { SimilarityWorkbenchLayout } from './SimilarityWorkbenchLayout';

vi.mock('../../infrastructure/api/corpus');
vi.mock('../../infrastructure/api/embeddings');
vi.mock('../../infrastructure/api/similarity');

const CATALOGUE: ListSimilarityAlgorithmsResponse = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
];

const DP_TRACE: DpMatrixTrace = {
  algorithmId: 'levenshtein',
  rowLabels: ['', 'k', 'i', 't'],
  columnLabels: ['', 's', 'i', 't'],
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
  operations: [],
};

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

/** No `matchMedia` implementation reports a narrow viewport by itself —
 * this fakes the `(min-width: 1024px)` list `useIsAtLeastLg` reads,
 * matching the shared default stub's own shape (`src/test/setup.ts`). */
function stubNarrowViewport() {
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/similarity']}>
        <Routes>
          <Route path="/similarity" element={<SimilarityWorkbenchLayout />}>
            <Route index element={<p>similarity results</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Prints the router's live location as text, so a test can assert on the
 * URL a navigation actually produced without reaching into router
 * internals. Works anywhere inside the `MemoryRouter`, matched route or
 * not — `useLocation` is never scoped to a particular `Route`. */
function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

/** The same route shape `App.tsx` nests under the workbench layout, so a
 * trace opened from a row click is exercised against real route matching
 * (`SimilarityPage` renders for both `similarity` and its trace deep link). */
function renderLayoutAtRoute(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <Routes>
          <Route path="/similarity" element={<SimilarityWorkbenchLayout />}>
            <Route index element={<SimilarityPage />} />
            <Route path=":algorithmId/trace" element={<SimilarityPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
  vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
    { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
  ]);
  vi.spyOn(corpusApi, 'fetchCorpusDocument').mockResolvedValue({
    id: 'doc-01',
    title: 'A survey of string similarity',
    authors: ['A. One'],
    abstract: 'The full abstract.',
  });
  vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(EMBEDDINGS_STATUS);
  vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
  vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);
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
});

describe('SimilarityWorkbenchLayout', () => {
  it('renders the rail next to the routed screen content', async () => {
    renderLayout();

    expect(
      await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeInTheDocument();
    expect(screen.getByText('similarity results')).toBeInTheDocument();
  });

  it('opens the abstract in the detail region when a rail title is activated, and closes it', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(await screen.findByRole('button', { name: 'A survey of string similarity' }));

    expect(await screen.findByText('The full abstract.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByText('The full abstract.')).not.toBeInTheDocument();
  });

  it('opens the embeddings detail from the rail status row, replacing an open abstract', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(await screen.findByRole('button', { name: 'A survey of string similarity' }));
    expect(await screen.findByText('The full abstract.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver el estado de los embeddings' }));

    expect(screen.queryByText('The full abstract.')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Estado de los embeddings' }),
    ).toBeInTheDocument();
  });

  describe('closing the detail panel returns focus to the control that opened it', () => {
    it('returns focus to the rail title after closing an abstract it opened', async () => {
      const user = userEvent.setup();
      renderLayout();

      const title = await screen.findByRole('button', { name: 'A survey of string similarity' });
      await user.click(title);
      await screen.findByText('The full abstract.');

      await user.click(screen.getByRole('button', { name: 'Cerrar' }));

      expect(title).toHaveFocus();
    });

    it('returns focus to the embeddings status row after closing the embeddings detail it opened', async () => {
      const user = userEvent.setup();
      renderLayout();

      const statusRow = await screen.findByRole('button', {
        name: 'Ver el estado de los embeddings',
      });
      await user.click(statusRow);
      await screen.findByRole('heading', { name: 'Estado de los embeddings' });

      await user.click(screen.getByRole('button', { name: 'Cerrar' }));

      expect(statusRow).toHaveFocus();
    });
  });

  describe('below the lg breakpoint, where WorkbenchLayout hides its own detail region', () => {
    beforeEach(() => {
      stubNarrowViewport();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('opens an article abstract as a dialog instead of leaving it unreachable, and returns focus to the title on close', async () => {
      const user = userEvent.setup();
      renderLayout();

      const title = await screen.findByRole('button', { name: 'A survey of string similarity' });
      await user.click(title);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('The full abstract.')).toBeInTheDocument();
      // Never both at once: the docked/overlay region never mounts below `lg`.
      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(title).toHaveFocus();
    });

    it('opens the embeddings detail as a dialog, and returns focus to the status row on close', async () => {
      const user = userEvent.setup();
      renderLayout();

      const statusRow = await screen.findByRole('button', {
        name: 'Ver el estado de los embeddings',
      });
      await user.click(statusRow);

      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByRole('heading', { name: 'Estado de los embeddings' }),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(statusRow).toHaveFocus();
    });

    it('closes the dialog on Escape', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(
        await screen.findByRole('button', { name: 'A survey of string similarity' }),
      );
      await screen.findByRole('dialog');

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('the trace deep link', () => {
    beforeEach(() => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
    });

    it('opens the docked/overlay detail region on the algorithm trace named by the URL, at lg and above', async () => {
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

      const detail = await screen.findByTestId('workbench-detail');
      expect(
        await within(detail).findByRole('heading', { name: 'Levenshtein distance' }),
      ).toBeInTheDocument();
      // The results table stays mounted next to it, in the center.
      expect(screen.getByRole('heading', { name: 'Comparación de similitud' })).toBeInTheDocument();
    });

    it('closes by navigating to /similarity, keeping the table in place (never a reload)', async () => {
      const user = userEvent.setup();
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

      await waitForCompareTable();
      const callsBeforeClose = vi.mocked(similarityApi.compareSimilarity).mock.calls.length;

      await screen.findByRole('button', { name: 'Cerrar traza' });
      await user.click(screen.getByRole('button', { name: 'Cerrar traza' }));

      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Comparación de similitud' })).toBeInTheDocument();
      // The table's own rows, not only its heading, are still there — header
      // + the one result row this suite's catalogue produces — and the
      // compare data behind them was never re-fetched, proof the table
      // itself was never torn down and rebuilt as a side effect of closing.
      expect(screen.getAllByRole('row')).toHaveLength(2);
      expect(
        within(screen.getByRole('row', { name: /^levenshtein/i })).getByRole('button', {
          name: 'levenshtein',
        }),
      ).toBeInTheDocument();
      expect(vi.mocked(similarityApi.compareSimilarity).mock.calls.length).toBe(callsBeforeClose);
    });

    it('closes on Escape at lg and above (the docked/overlay panel is non-modal, so it needs its own listener)', async () => {
      const user = userEvent.setup();
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

      await screen.findByTestId('workbench-detail');
      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
    });

    it('returns focus to the row that opened it, after closing', async () => {
      const user = userEvent.setup();
      renderLayoutAtRoute('/similarity');

      await waitForCompareTable();
      const row = await screen.findByRole('row', { name: /^levenshtein/i });
      const rowButton = within(row).getByRole('button', { name: 'levenshtein' });
      await user.click(rowButton);

      await screen.findByRole('button', { name: 'Cerrar traza' });
      await user.click(screen.getByRole('button', { name: 'Cerrar traza' }));

      expect(rowButton).toHaveFocus();
    });

    it('closes the deep-linked trace and drops its document ids from the URL once the rail names a different pair', async () => {
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

      await screen.findByTestId('workbench-detail');

      act(() => {
        useSelectionStore.setState({
          selectedIds: ['doc-03', 'doc-04'],
          canCompare: true,
          canMatrix: false,
        });
      });

      await waitFor(() => expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument());
      const location = await screen.findByTestId('location');
      expect(location).toHaveTextContent('/similarity');
      expect(location.textContent).not.toContain('/trace');
      expect(location.textContent).not.toContain('documentIdA');
      expect(location.textContent).not.toContain('documentIdB');
    });

    describe('below lg', () => {
      beforeEach(() => {
        stubNarrowViewport();
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('opens the trace as a full-height dialog instead of the docked region', async () => {
        renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

        const dialog = await screen.findByRole('dialog');
        expect(
          await within(dialog).findByRole('heading', { name: 'Levenshtein distance' }),
        ).toBeInTheDocument();
        expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
      });

      it('closes the dialog on Escape and returns focus to the row', async () => {
        const user = userEvent.setup();
        renderLayoutAtRoute('/similarity');

        await waitForCompareTable();
        const row = await screen.findByRole('row', { name: /^levenshtein/i });
        const rowButton = within(row).getByRole('button', { name: 'levenshtein' });
        await user.click(rowButton);

        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(rowButton).toHaveFocus();
      });
    });
  });

  describe('a partial trace URL (the trace path matched, but its document ids are missing)', () => {
    it('normalizes the URL back to plain /similarity instead of leaving a stale trace path over a screen showing no panel', async () => {
      renderLayoutAtRoute('/similarity/levenshtein/trace');

      const location = await screen.findByTestId('location');
      // The starting path already contains `/similarity`, so wait for the
      // part that only the normalization removes.
      await waitFor(() => expect(location.textContent).not.toContain('/trace'));
      expect(location).toHaveTextContent('/similarity');
      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('normalizes the URL even with just one of the two document ids present', async () => {
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01');

      const location = await screen.findByTestId('location');
      await waitFor(() => expect(location.textContent).not.toContain('/trace'));
      expect(location).toHaveTextContent('/similarity');
      expect(location.textContent).not.toContain('documentIdA');
      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
    });
  });

  describe('a trace opened while a rail detail view is already showing', () => {
    beforeEach(() => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
    });

    it('replaces an open abstract when a trace opens — one panel at a time', async () => {
      const user = userEvent.setup();
      renderLayoutAtRoute('/similarity');

      await user.click(
        await screen.findByRole('button', { name: 'A survey of string similarity' }),
      );
      expect(await screen.findByText('The full abstract.')).toBeInTheDocument();

      await waitForCompareTable();
      const row = await screen.findByRole('row', { name: /^levenshtein/i });
      await user.click(within(row).getByRole('button', { name: 'levenshtein' }));

      const detail = await screen.findByTestId('workbench-detail');
      expect(
        await within(detail).findByRole('heading', { name: 'Levenshtein distance' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('The full abstract.')).not.toBeInTheDocument();
    });

    it('does not resurrect the previously open abstract once the trace opened over it closes, and returns focus to the trace’s own row', async () => {
      const user = userEvent.setup();
      renderLayoutAtRoute('/similarity');

      await user.click(
        await screen.findByRole('button', { name: 'A survey of string similarity' }),
      );
      await screen.findByText('The full abstract.');

      await waitForCompareTable();
      const row = await screen.findByRole('row', { name: /^levenshtein/i });
      const rowButton = within(row).getByRole('button', { name: 'levenshtein' });
      await user.click(rowButton);
      await screen.findByTestId('workbench-detail');

      await user.click(await screen.findByRole('button', { name: 'Cerrar traza' }));

      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
      expect(screen.queryByText('The full abstract.')).not.toBeInTheDocument();
      expect(rowButton).toHaveFocus();
    });
  });
});

/** Waits until the compare table itself (not just the loading/empty state)
 * has actually rendered its rows. */
async function waitForCompareTable() {
  await screen.findAllByRole('row');
}
