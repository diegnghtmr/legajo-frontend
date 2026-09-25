import { act } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import * as embeddingsApi from '../../infrastructure/api/embeddings';
import { useSelectionStore } from './selectionStore';
import { STICKY_CTA_HEIGHT_VAR, STICKY_CTA_SCROLL_MARGIN_BOTTOM } from './stickyCta';

vi.mock('../../infrastructure/api/corpus');
vi.mock('../../infrastructure/api/embeddings');

import { CorpusDetail } from './CorpusDetail';
import { CorpusDetailPlaceholder } from './CorpusDetailPlaceholder';
import { CorpusPage } from './CorpusPage';

/**
 * A controllable double for the real `ResizeObserver` (jsdom has none; the
 * shared test setup installs a no-op default): `observe` records the target
 * so a test can drive the exact same callback the component itself passed
 * in, instead of the no-op default that never calls back at all.
 */
class FakeResizeObserver implements ResizeObserver {
  static callback: ResizeObserverCallback | undefined;

  constructor(callback: ResizeObserverCallback) {
    FakeResizeObserver.callback = callback;
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function triggerResize(heightPx: number) {
  act(() => {
    FakeResizeObserver.callback?.(
      [
        {
          borderBoxSize: [{ blockSize: heightPx, inlineSize: 0 }],
        } as unknown as ResizeObserverEntry,
      ],
      new FakeResizeObserver(() => {}),
    );
  });
}

function renderCorpusRoutes(initialPath = '/corpus') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/corpus" element={<CorpusPage />}>
            <Route index element={<CorpusDetailPlaceholder />} />
            <Route path=":id" element={<CorpusDetail />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

const EMBEDDINGS_STATUS = {
  embeddingLocal: {
    provider: 'sentence-transformers',
    model: 'all-MiniLM-L6-v2',
    dimension: 384,
    corpusSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    matchesCorpus: true,
    device: 'cpu',
  },
  embeddingApi: {
    provider: 'google',
    model: 'gemini-embedding-2-preview',
    dimension: 1536,
    corpusSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    matchesCorpus: true,
    mode: 'cached' as const,
  },
};

describe('CorpusPage', () => {
  it('renders the corpus title, the article list, the select-an-article prompt and the embeddings status panel by default', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
      { id: 'doc-01', title: 'First article', authors: ['A. One'] },
    ]);
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(EMBEDDINGS_STATUS);

    renderCorpusRoutes();

    expect(screen.getByRole('heading', { name: 'Artículos del corpus' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'First article' })).toBeInTheDocument();
    expect(
      screen.getByText('Selecciona un artículo para ver su resumen completo.'),
    ).toBeInTheDocument();
    const compareButton = screen.getByRole('button', { name: 'Comparar' });
    const matrixButton = screen.getByRole('button', { name: 'Ver matriz' });
    expect(compareButton).toBeDisabled();
    expect(matrixButton).toBeDisabled();
    // Both CTAs share one sticky bottom bar (jsdom performs no real layout,
    // so this asserts the CSS contract, not an actual scroll position —
    // verified against a live render).
    const ctaBar = compareButton.closest('.sticky');
    expect(ctaBar).not.toBeNull();
    expect(ctaBar).toHaveClass('bottom-0');
    expect(ctaBar).toContainElement(matrixButton);
    expect(
      await screen.findByRole('heading', { name: 'Estado de los embeddings' }),
    ).toBeInTheDocument();
    expect(screen.getByText('embedding-local')).toBeInTheDocument();
    expect(screen.getByText('embedding-api')).toBeInTheDocument();
  });

  it('navigating to an article shows its detail next to the still-visible list', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
      { id: 'doc-01', title: 'First article', authors: ['A. One'] },
    ]);
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockResolvedValue({
      id: 'doc-01',
      title: 'First article',
      authors: ['A. One'],
      abstract: 'The full abstract.',
    });
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(EMBEDDINGS_STATUS);
    const user = userEvent.setup();

    renderCorpusRoutes();

    await user.click(await screen.findByRole('link', { name: 'First article' }));

    expect(await screen.findByText('The full abstract.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'First article' })).toBeInTheDocument();
  });

  it('an embeddings-status fetch failure is shown only inside its own panel and never hides the article list', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
      { id: 'doc-01', title: 'First article', authors: ['A. One'] },
    ]);
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockRejectedValue({
      kind: 'network',
      cause: 'timeout',
      i18nKey: 'errors.network.coldStart',
    });

    renderCorpusRoutes();

    expect(await screen.findByRole('link', { name: 'First article' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparar' })).toBeInTheDocument();
    expect(
      await screen.findByText('No se pudo cargar el estado de los embeddings'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'First article' })).toBeInTheDocument();
  });

  describe('the sticky CTA bar height', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("updates the shared custom property when the bar's own height changes, instead of a fixed guess", async () => {
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
        { id: 'doc-01', title: 'First article', authors: ['A. One'] },
      ]);
      vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(EMBEDDINGS_STATUS);

      renderCorpusRoutes();
      const compareButton = await screen.findByRole('button', { name: 'Comparar' });
      const section = compareButton.closest('section')!;

      triggerResize(260);

      expect(section.style.getPropertyValue(STICKY_CTA_HEIGHT_VAR)).toBe('260px');
    });

    it('reads the border-box height (border + padding included), never the content-box height alone', async () => {
      // A real `ResizeObserver` fires this callback automatically once,
      // right after `observe()`, even with no actual resize — so this must
      // hold for the very first callback, not only a later "real" one.
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
        { id: 'doc-01', title: 'First article', authors: ['A. One'] },
      ]);
      vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(EMBEDDINGS_STATUS);

      renderCorpusRoutes();
      const compareButton = await screen.findByRole('button', { name: 'Comparar' });
      const section = compareButton.closest('section')!;

      // A content-box height (what `entry.contentRect.height` alone would
      // give) would be smaller than this by the bar's own border + padding.
      triggerResize(150);

      expect(section.style.getPropertyValue(STICKY_CTA_HEIGHT_VAR)).toBe('150px');
    });

    it("keeps the list's own bottom padding reading the same shared custom property as the rows' scroll-margin-bottom", async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([
        { id: 'doc-01', title: 'First article', authors: ['A. One'] },
      ]);
      vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(EMBEDDINGS_STATUS);

      renderCorpusRoutes();
      const list = await screen.findByRole('list');

      expect((list.parentElement as HTMLElement).style.paddingBottom).toBe(
        STICKY_CTA_SCROLL_MARGIN_BOTTOM,
      );
    });
  });
});
