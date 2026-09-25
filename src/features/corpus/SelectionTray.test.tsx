import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import * as embeddingsApi from '../../infrastructure/api/embeddings';
import { useSelectionStore } from './selectionStore';
import { SelectionTray } from './SelectionTray';

vi.mock('../../infrastructure/api/corpus');
vi.mock('../../infrastructure/api/embeddings');

const ARTICLES = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['B. Two'] },
  { id: 'doc-03', title: 'Clustering theory refresher', authors: ['C. Three'] },
  { id: 'doc-04', title: 'A fourth article', authors: ['D. Four'] },
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

function renderTray(overrides: Partial<Parameters<typeof SelectionTray>[0]> = {}) {
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
              <SelectionTray
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
 * The rail's below-`lg` replacement: docked at the bottom, it shows the
 * count and the selected mono ids on one line (never open by itself), plus
 * the same adaptive CTA `SelectionRail` uses. Tapping the summary — not the
 * CTA — opens the full corpus list as a bottom sheet.
 */
describe('SelectionTray', () => {
  it('shows the selected count and the adaptive CTA, disabled with a reason below two selected', () => {
    renderTray();

    expect(screen.getByText('0 seleccionados')).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: 'Comparar' });
    expect(cta).toBeDisabled();
    expect(screen.getByText('Selecciona al menos 2 para comparar.')).toBeInTheDocument();
  });

  it('enables the CTA and reads the sorted pair label at exactly two selected', () => {
    useSelectionStore.setState({
      selectedIds: ['doc-02', 'doc-01'],
      canCompare: true,
      canMatrix: false,
    });
    renderTray();

    expect(screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' })).toBeEnabled();
  });

  it('shows the selected mono ids on one line, up to three, with a "+N" overflow for the rest', () => {
    useSelectionStore.setState({
      selectedIds: ['doc-04', 'doc-03', 'doc-02', 'doc-01'],
      canCompare: true,
      canMatrix: true,
    });
    renderTray();

    const summary = screen.getByRole('button', { name: 'Abrir la lista del corpus' });
    expect(summary).toHaveTextContent('doc-01');
    expect(summary).toHaveTextContent('doc-02');
    expect(summary).toHaveTextContent('doc-03');
    expect(summary).not.toHaveTextContent('doc-04');
    expect(summary).toHaveTextContent('+1');
  });

  it("tapping the summary opens the corpus list as a bottom sheet, reusing the rail's own rows", async () => {
    const user = userEvent.setup();
    renderTray();

    await user.click(screen.getByRole('button', { name: 'Abrir la lista del corpus' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeInTheDocument();
  });

  it('never opens the sheet by tapping the CTA itself', async () => {
    const user = userEvent.setup();
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02'],
      canCompare: true,
      canMatrix: false,
    });
    renderTray();

    await user.click(screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onCtaActivate the instant the CTA is activated, never on a mere selection change', async () => {
    const user = userEvent.setup();
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02'],
      canCompare: true,
      canMatrix: false,
    });
    const onCtaActivate = vi.fn();
    renderTray({ onCtaActivate });

    expect(onCtaActivate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' }));

    expect(onCtaActivate).toHaveBeenCalledTimes(1);
  });

  it("closes the list sheet and forwards to the layout's own abstract handler when a row title is activated", async () => {
    const user = userEvent.setup();
    const { onOpenAbstract } = renderTray();

    await user.click(screen.getByRole('button', { name: 'Abrir la lista del corpus' }));
    await user.click(await screen.findByRole('button', { name: 'A survey of string similarity' }));

    expect(onOpenAbstract).toHaveBeenCalledWith('doc-01');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selecting two articles from the still-open sheet, then closing it (Escape), reveals the now-enabled CTA underneath', async () => {
    const user = userEvent.setup();
    renderTray();

    await user.click(screen.getByRole('button', { name: 'Abrir la lista del corpus' }));
    await user.click(
      await screen.findByRole('checkbox', { name: 'A survey of string similarity' }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Embeddings for scientific text' }));

    // Modal while open: the tray's own CTA underneath is inert (Radix
    // marks the rest of the page `aria-hidden`), not merely visually
    // covered — activating it is never available until the sheet closes.
    expect(
      screen.queryByRole('button', { name: 'Comparar doc-01 y doc-02' }),
    ).not.toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const cta = screen.getByRole('button', { name: 'Comparar doc-01 y doc-02' });
    expect(cta).toBeEnabled();
  });
});
