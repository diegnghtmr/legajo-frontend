import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as embeddingsApi from '../../infrastructure/api/embeddings';

vi.mock('../../infrastructure/api/embeddings');

import { EmbeddingsStatusPanel } from './EmbeddingsStatusPanel';

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const BASE_STATUS = {
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('EmbeddingsStatusPanel', () => {
  it('shows a hidden loading status and two family skeleton sections before the query resolves', () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<EmbeddingsStatusPanel />);

    const status = screen.getByRole('status');
    expect(status.className).toContain('sr-only');

    const skeleton = screen.getByTestId('embeddings-status-skeleton');
    expect(skeleton.children).toHaveLength(2);
    expect(skeleton.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    // Every field, including the model id, is a single line: at this
    // panel's own column width, at any width this app supports, a real
    // model id (even a long one like "gemini-embedding-2-preview") never
    // actually wraps.
    for (const label of ['Proveedor', 'Modelo', 'Dimensión']) {
      const dt = within(skeleton).getAllByText(label)[0]!;
      const valueBars = dt.parentElement?.querySelectorAll('[data-slot="skeleton"]');
      expect(valueBars).toHaveLength(1);
    }
  });

  it('renders both embedding families with their provider, model, dimension and device/mode', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(BASE_STATUS);

    renderWithProviders(<EmbeddingsStatusPanel />);

    // `embedding-local`/`embedding-api` are the section headings' own real
    // text, shown immediately even while the request is still pending
    // (they are route constants, never response data) — waited on a value
    // that only exists once the response actually resolves instead.
    expect(await screen.findByText('sentence-transformers')).toBeInTheDocument();
    expect(screen.getByText('embedding-local')).toBeInTheDocument();
    expect(screen.getByText('embedding-api')).toBeInTheDocument();
    expect(screen.getByText('all-MiniLM-L6-v2')).toBeInTheDocument();
    expect(screen.getByText('384')).toBeInTheDocument();
    expect(screen.getByText('cpu')).toBeInTheDocument();
    expect(screen.getByText('google')).toBeInTheDocument();
    expect(screen.getByText('gemini-embedding-2-preview')).toBeInTheDocument();
    expect(screen.getByText('1536')).toBeInTheDocument();
  });

  it('shows the shortened corpusSha256 with the full value available via title', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(BASE_STATUS);

    renderWithProviders(<EmbeddingsStatusPanel />);

    const shaElements = await screen.findAllByTitle(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    );
    expect(shaElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText('e3b0c442…852b85').length).toBeGreaterThan(0);
  });

  it('shows a quiet "matches" label when matchesCorpus is true for both families', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(BASE_STATUS);

    renderWithProviders(<EmbeddingsStatusPanel />);

    expect(await screen.findByTestId('embeddings-status-local-match')).toHaveTextContent(
      'Coincide con el corpus',
    );
    expect(screen.getByTestId('embeddings-status-api-match')).toHaveTextContent(
      'Coincide con el corpus',
    );
    expect(screen.queryByText('No coincide con el corpus')).not.toBeInTheDocument();
  });

  it('clearly shows the mismatch label (not color-only) when matchesCorpus is false', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue({
      ...BASE_STATUS,
      embeddingLocal: { ...BASE_STATUS.embeddingLocal, matchesCorpus: false },
    });

    renderWithProviders(<EmbeddingsStatusPanel />);

    const mismatch = await screen.findByTestId('embeddings-status-local-match');
    expect(mismatch).toHaveTextContent('No coincide con el corpus');
    expect(mismatch.className).toContain('text-danger');
    expect(screen.getByTestId('embeddings-status-api-match')).toHaveTextContent(
      'Coincide con el corpus',
    );
  });

  it('labels the live mode distinctly from cached, in text and not only in color', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue({
      ...BASE_STATUS,
      embeddingApi: { ...BASE_STATUS.embeddingApi, mode: 'live' },
    });

    renderWithProviders(<EmbeddingsStatusPanel />);

    expect(await screen.findByTestId('embeddings-status-api-mode')).toHaveTextContent('En vivo');
    expect(screen.queryByText('En caché')).not.toBeInTheDocument();
  });

  it('shows the cached mode label when mode is cached', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(BASE_STATUS);

    renderWithProviders(<EmbeddingsStatusPanel />);

    expect(await screen.findByTestId('embeddings-status-api-mode')).toHaveTextContent('En caché');
  });

  it('never labels an unrecognized mode value as cached, showing a neutral unknown label instead', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue({
      ...BASE_STATUS,
      embeddingApi: {
        ...BASE_STATUS.embeddingApi,
        mode: 'stale' as unknown as (typeof BASE_STATUS.embeddingApi)['mode'],
      },
    });

    renderWithProviders(<EmbeddingsStatusPanel />);

    const modeField = await screen.findByTestId('embeddings-status-api-mode');
    expect(modeField).toHaveTextContent('Modo desconocido');
    expect(modeField).not.toHaveTextContent('En caché');
  });

  it('keeps every dt/dd group as a direct child of its dl (no double-wrapped div, per HTML5)', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue(BASE_STATUS);

    const { container } = renderWithProviders(<EmbeddingsStatusPanel />);
    await screen.findByText('embedding-local');

    const dls = container.querySelectorAll('dl');
    expect(dls.length).toBeGreaterThan(0);
    for (const dl of dls) {
      for (const child of Array.from(dl.children)) {
        // Either the child is itself dt/dd, or it is a single div wrapping
        // one dt/dd group directly (no further nested div in between).
        if (child.tagName === 'DIV') {
          expect(child.firstElementChild?.tagName).toMatch(/^(DT|DD)$/);
        } else {
          expect(child.tagName).toMatch(/^(DT|DD)$/);
        }
      }
    }
  });

  it('shows the mapped error message inside the panel when the query rejects', async () => {
    vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockRejectedValue({
      kind: 'network',
      cause: 'timeout',
      i18nKey: 'errors.network.coldStart',
    });

    renderWithProviders(<EmbeddingsStatusPanel />);

    expect(
      await screen.findByText(
        'No se pudo contactar al servidor. Si es la primera solicitud en un rato, el servidor gratuito puede estar despertando: puede tardar hasta un minuto en responder.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
