import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import * as embeddingsApi from '../../infrastructure/api/embeddings';
import { useSelectionStore } from '../corpus/selectionStore';
import { SimilarityWorkbenchLayout } from './SimilarityWorkbenchLayout';

vi.mock('../../infrastructure/api/corpus');
vi.mock('../../infrastructure/api/embeddings');

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
});
