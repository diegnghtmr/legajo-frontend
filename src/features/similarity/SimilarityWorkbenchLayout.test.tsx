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
import { stubMatchMedia, stubNarrowViewport } from '../../test/matchMedia';
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

    await user.click(screen.getByRole('button', { name: /^Embeddings:/ }));

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
        name: /^Embeddings:/,
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
        name: /^Embeddings:/,
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
      expect(screen.getByRole('heading', { name: 'doc-01 frente a doc-02' })).toBeInTheDocument();
    });

    it('closes by navigating to /similarity, keeping the table in place (never a reload)', async () => {
      const user = userEvent.setup();
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

      await waitForCompareTable();
      const callsBeforeClose = vi.mocked(similarityApi.compareSimilarity).mock.calls.length;

      await screen.findByRole('button', { name: 'Cerrar traza' });
      await user.click(screen.getByRole('button', { name: 'Cerrar traza' }));

      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'doc-01 frente a doc-02' })).toBeInTheDocument();
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

    describe('a tablet rotation (or any resize) crossing the breakpoint while the trace stays open', () => {
      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('resolves the remembered trigger by algorithm id against whichever results view is mounted', async () => {
        const mediaQueryList = stubMatchMedia(true);
        const user = userEvent.setup();
        renderLayoutAtRoute('/similarity');

        await waitForCompareTable();
        const tableRow = await screen.findByRole('row', { name: /^levenshtein/i });
        await user.click(within(tableRow).getByRole('button', { name: 'levenshtein' }));
        await screen.findByTestId('workbench-detail');

        // The table unmounts in favor of the results list, and the row
        // button `rememberTraceTrigger` captured is no longer in the
        // document.
        act(() => {
          mediaQueryList.fireChange(false);
        });

        // The now-open below-`lg` trace sheet is a real Radix `Dialog`,
        // which marks the rest of the page `aria-hidden` while it is open —
        // `hidden: true` still finds the results list underneath it (its
        // DOM node, and the row button's real focusability, are both
        // unaffected by that accessibility-tree veil).
        const list = await screen.findByRole('list', {
          name: 'Resultados de similitud por algoritmo',
          hidden: true,
        });
        const listRowButton = within(list).getByRole('button', {
          name: 'levenshtein',
          hidden: true,
        });
        const dialog = await screen.findByRole('dialog');

        await user.click(within(dialog).getByRole('button', { name: 'Cerrar traza' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(listRowButton).toHaveFocus();
      });
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

        // Below `lg` the results render as a list (`CompareResultsList`),
        // never a table — its own row is still the trace trigger. Scoped to
        // the list: the family filter above it has its own same-named
        // toggle button for every algorithm id.
        const list = await screen.findByRole('list', {
          name: 'Resultados de similitud por algoritmo',
        });
        const rowButton = within(list).getByRole('button', { name: 'levenshtein' });
        await user.click(rowButton);

        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(rowButton).toHaveFocus();
      });
    });
  });

  describe('a cold deep link to the trace route with an empty rail selection', () => {
    beforeEach(() => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
        { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
        { id: 'doc-02', title: 'A second article', authors: ['B. Two'] },
      ]);
    });

    it('seeds the rail selection from the URL pair, checking both articles and enabling the confirmed CTA, at lg and above', async () => {
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

      expect(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      ).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'A second article' })).toBeChecked();
      const cta = screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' });
      expect(cta).toBeEnabled();
    });

    describe('below lg', () => {
      beforeEach(() => {
        stubNarrowViewport();
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('seeds the tray selection too, and never flips to the corpus list once the trace closes', async () => {
        const user = userEvent.setup();
        renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

        await screen.findByRole('dialog');
        // The seed itself waits on the corpus fetch resolving, so this
        // needs to poll rather than read the CTA's state the instant the
        // dialog first appears. The open trace dialog marks the rest of
        // the page `aria-hidden` while it stays open (a real Radix
        // `Dialog`) — `hidden: true` still finds the tray's own CTA
        // underneath it.
        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: 'Comparar doc-01 y doc-02', hidden: true }),
          ).toBeEnabled(),
        );

        await user.click(await screen.findByRole('button', { name: 'Cerrar traza' }));

        // Already confirmed from the deep link itself — never reverts to
        // the corpus list just because the trace closed.
        expect(
          await screen.findByRole('list', { name: 'Resultados de similitud por algoritmo' }),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole('checkbox', { name: 'A survey of string similarity' }),
        ).not.toBeInTheDocument();
      });
    });

    it('never seeds an unknown document id from a stray or mistyped URL', async () => {
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-99&documentIdB=doc-98');

      await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
      expect(
        screen.getByRole('checkbox', { name: 'A survey of string similarity' }),
      ).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'A second article' })).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Comparar' })).toBeDisabled();
    });

    it('never overrides a rail selection the person already made before this resolves', async () => {
      useSelectionStore.setState({
        selectedIds: ['doc-02'],
        canCompare: false,
        canMatrix: false,
      });
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

      await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
      expect(screen.getByRole('checkbox', { name: 'A second article' })).toBeChecked();
      expect(
        screen.getByRole('checkbox', { name: 'A survey of string similarity' }),
      ).not.toBeChecked();
    });
  });

  describe('an openAbstract query param (from /corpus/:id, CorpusArticleRedirect)', () => {
    it('opens that article in the detail panel once the corpus resolves, then clears the query param', async () => {
      renderLayoutAtRoute('/similarity?openAbstract=doc-01');

      const panel = await screen.findByTestId('workbench-detail');
      expect(
        await within(panel).findByRole('heading', { name: 'A survey of string similarity' }),
      ).toBeInTheDocument();

      const location = await screen.findByTestId('location');
      await waitFor(() => expect(location).toHaveTextContent('/similarity'));
      expect(location.textContent).not.toContain('openAbstract');
    });

    it('never opens the panel for an unknown id, and still clears the query param down to plain /similarity', async () => {
      renderLayoutAtRoute('/similarity?openAbstract=doc-99');

      // Give the corpus fetch (and this effect) a chance to settle before
      // asserting the negative — the same "wait, then assert nothing
      // opened" shape the trace deep link's own unknown-id test uses.
      await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();

      const location = await screen.findByTestId('location');
      await waitFor(() => expect(location.textContent).not.toContain('openAbstract'));
      expect(location).toHaveTextContent('/similarity');
    });

    describe('below lg', () => {
      beforeEach(() => {
        stubNarrowViewport();
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('opens the same article as a sheet instead of the docked panel', async () => {
        renderLayoutAtRoute('/similarity?openAbstract=doc-01');

        const dialog = await screen.findByRole('dialog');
        expect(
          await within(dialog).findByRole('heading', { name: 'A survey of string similarity' }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('below lg, before any comparison, on the plain compare route', () => {
    beforeEach(() => {
      stubNarrowViewport();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('shows the corpus list itself as the main content instead of the "select 2" message, and hides the lg+ rail', async () => {
      renderLayoutAtRoute('/similarity');

      expect(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Comparación de similitud' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('workbench-rail')).not.toBeInTheDocument();
    });

    it('docks the selection tray at the bottom, with the CTA disabled below two selected', async () => {
      renderLayoutAtRoute('/similarity');

      await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
      expect(screen.getByTestId('selection-tray')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Comparar' })).toBeDisabled();
    });

    it('a basic comparison takes exactly three interactions: select, select, compare', async () => {
      const user = userEvent.setup();
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
        { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
        { id: 'doc-02', title: 'A second article', authors: ['B. Two'] },
      ]);
      renderLayoutAtRoute('/similarity');

      // Interaction 1: select the first article.
      await user.click(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      );
      // Interaction 2: select the second article.
      await user.click(screen.getByRole('checkbox', { name: 'A second article' }));

      const cta = screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' });
      expect(cta).toBeEnabled();

      // Interaction 3: compare.
      await user.click(cta);

      // Below `lg` the results render as a list (`CompareResultsList`),
      // never a table.
      expect(
        await screen.findByRole('list', { name: 'Resultados de similitud por algoritmo' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', { name: 'A survey of string similarity' }),
      ).not.toBeInTheDocument();
    });

    it('a pair already selected when this screen first opens (a deep link, a restored selection) shows the pairwise results immediately, with no redundant re-confirmation', async () => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
      renderLayoutAtRoute('/similarity');

      expect(
        await screen.findByRole('heading', { name: 'doc-01 frente a doc-02' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', { name: 'A survey of string similarity' }),
      ).not.toBeInTheDocument();
    });

    it('replacing an already-shown pair with a genuinely different one (never through this tray CTA) shows the corpus list again, needing its own fresh confirmation', async () => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
      renderLayoutAtRoute('/similarity');
      await screen.findByRole('heading', { name: 'doc-01 frente a doc-02' });

      act(() => {
        useSelectionStore.setState({
          selectedIds: ['doc-03', 'doc-04'],
          canCompare: true,
          canMatrix: false,
        });
      });

      expect(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Comparación de similitud' }),
      ).not.toBeInTheDocument();

      // Confirming the CTA for that new pair shows its own results.
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Comparar doc-03 y doc-04' }));

      expect(
        await screen.findByRole('heading', { name: 'doc-03 frente a doc-04' }),
      ).toBeInTheDocument();
    });

    it('deselecting then reselecting the exact same pair needs its own fresh confirmation, not an immediate re-confirm', async () => {
      const user = userEvent.setup();
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
        { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
        { id: 'doc-02', title: 'A second article', authors: ['B. Two'] },
      ]);
      renderLayoutAtRoute('/similarity');

      await user.click(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      );
      await user.click(screen.getByRole('checkbox', { name: 'A second article' }));
      await user.click(screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' }));
      await screen.findByRole('list', { name: 'Resultados de similitud por algoritmo' });

      // Deselects one article (the pair stops existing), then reselects it —
      // the exact same pair key as before, which the layout must not
      // silently treat as still confirmed.
      act(() => {
        useSelectionStore.setState({
          selectedIds: ['doc-02'],
          canCompare: false,
          canMatrix: false,
        });
      });
      act(() => {
        useSelectionStore.setState({
          selectedIds: ['doc-01', 'doc-02'],
          canCompare: true,
          canMatrix: false,
        });
      });

      expect(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('list', { name: 'Resultados de similitud por algoritmo' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('a pair selected while still at lg, then the viewport shrinks below lg', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('keeps showing the results instead of reverting to the corpus list, since results already showing at lg need no separate tray confirmation', async () => {
      const mediaQueryList = stubMatchMedia(true);
      const user = userEvent.setup();
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
        { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
        { id: 'doc-02', title: 'A second article', authors: ['B. Two'] },
      ]);
      renderLayoutAtRoute('/similarity');

      // At lg+, selecting through the persistent rail shows the compare
      // results directly (Outlet) — no separate CTA confirmation exists at
      // this width.
      await user.click(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      );
      await user.click(screen.getByRole('checkbox', { name: 'A second article' }));
      await waitForCompareTable();

      act(() => {
        mediaQueryList.fireChange(false);
      });

      expect(
        await screen.findByRole('list', { name: 'Resultados de similitud por algoritmo' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', { name: 'A survey of string similarity' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('at lg and above, the corpus-list-as-main-content replacement never applies', () => {
    it('keeps the "select 2" empty-state message and the persistent rail, with no tray', async () => {
      renderLayoutAtRoute('/similarity');

      expect(
        await screen.findByText(
          'Selecciona 2 artículos en el panel para comparar, o 3 o más para ver la matriz.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByTestId('workbench-rail')).toBeInTheDocument();
      expect(screen.queryByTestId('selection-tray')).not.toBeInTheDocument();
    });
  });

  describe('at lg and above, the center follows the corpus selection automatically', () => {
    beforeEach(() => {
      vi.spyOn(similarityApi, 'fetchSimilarityMatrix').mockResolvedValue([]);
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
        { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
        { id: 'doc-02', title: 'A second article', authors: ['B. Two'] },
        { id: 'doc-03', title: 'A third article', authors: ['C. Three'] },
      ]);
    });

    it('selecting a third article shows the matrix directly, with no click at all', async () => {
      const user = userEvent.setup();
      renderLayoutAtRoute('/similarity');

      await user.click(
        await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
      );
      await user.click(screen.getByRole('checkbox', { name: 'A second article' }));
      await user.click(screen.getByRole('checkbox', { name: 'A third article' }));

      expect(
        await screen.findByRole('heading', { name: 'Matriz de similitud' }),
      ).toBeInTheDocument();
    });

    it('dropping back to two after showing the matrix shows the pair instead, with no click', async () => {
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02', 'doc-03'],
        canCompare: true,
        canMatrix: true,
      });
      renderLayoutAtRoute('/similarity');
      await screen.findByRole('heading', { name: 'Matriz de similitud' });

      act(() => {
        useSelectionStore.setState({
          selectedIds: ['doc-01', 'doc-02'],
          canCompare: true,
          canMatrix: false,
        });
      });

      expect(
        await screen.findByRole('heading', { name: 'doc-01 frente a doc-02' }),
      ).toBeInTheDocument();
    });

    it('activating the rail CTA moves focus onto the already-shown results instead of navigating anywhere', async () => {
      const user = userEvent.setup();
      useSelectionStore.setState({
        selectedIds: ['doc-01', 'doc-02'],
        canCompare: true,
        canMatrix: false,
      });
      renderLayoutAtRoute('/similarity');
      await waitForCompareTable();
      const location = await screen.findByTestId('location');
      const locationBefore = location.textContent;

      await user.click(screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' }));

      expect(location).toHaveTextContent(locationBefore ?? '');
      expect(screen.getByTestId('similarity-results-region')).toHaveFocus();
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

    it('never opens the panel for a degenerate trace URL naming the same document twice, and normalizes the URL', async () => {
      renderLayoutAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-01');

      expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
      const location = await screen.findByTestId('location');
      await waitFor(() => expect(location.textContent).not.toContain('/trace'));
      expect(location.textContent).not.toContain('documentIdA');
      expect(location.textContent).not.toContain('documentIdB');
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
  // The loading skeleton's own row (`compare-table-skeleton-row`) already
  // carries its real mono algorithm id as text (it is known before the
  // compare fetch resolves), so a bare `findAllByRole('row')` above is
  // satisfied by the skeleton alone. Every caller of this helper goes on
  // to find a specific row by that same mono id and click its trigger
  // button — which only the real row has — so this waits past the
  // skeleton explicitly instead of leaving that race to each call site.
  await waitFor(() => {
    expect(screen.queryAllByTestId('compare-table-skeleton-row')).toHaveLength(0);
  });
}
