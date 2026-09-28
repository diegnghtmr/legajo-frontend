import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import * as embeddingsApi from '../../infrastructure/api/embeddings';
import es from '../../infrastructure/i18n/locales/es.json';
import { focusableInSkeletons } from '../../test/skeletonFocus';
import { useSelectionStore } from './selectionStore';
import { CorpusListPanel, embeddingsSummaryState } from './CorpusListPanel';

vi.mock('../../infrastructure/api/corpus');
vi.mock('../../infrastructure/api/embeddings');

const ARTICLES = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One', 'B. Two'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['C. Three'] },
  { id: 'doc-03', title: 'Clustering theory refresher', authors: ['D. Four'] },
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

function renderPanel(overrides: Partial<Parameters<typeof CorpusListPanel>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenAbstract = vi.fn();
  const onOpenEmbeddings = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/similarity']}>
        <CorpusListPanel
          onOpenAbstract={onOpenAbstract}
          onOpenEmbeddings={onOpenEmbeddings}
          {...overrides}
        />
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

/** Asserts a filtered-out row is entirely gone — neither of its two
 * affordances (the checkbox, the title button) remains — rather than only
 * one role's query, which would still report "not found" if the filter
 * broke in a way that removed just one of the row's two elements while
 * leaving the other still in the document. */
function expectRowGone(title: string) {
  expect(screen.queryByRole('checkbox', { name: title })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: title })).not.toBeInTheDocument();
}

describe('CorpusListPanel', () => {
  it('renders every article as a compact row with a separate checkbox and title affordance', async () => {
    renderPanel();

    const title = await screen.findByRole('button', { name: 'A survey of string similarity' });
    const checkbox = screen.getByRole('checkbox', { name: 'A survey of string similarity' });
    expect(title).toBeInTheDocument();
    expect(checkbox).toBeInTheDocument();
    expect(screen.getByText('doc-01')).toBeInTheDocument();
    // Authors are searchable but no longer shown in the compact row itself.
    expect(screen.queryByText('A. One, B. Two')).not.toBeInTheDocument();
  });

  it('opens the abstract when the title is activated, never toggling selection', async () => {
    const user = userEvent.setup();
    const { onOpenAbstract } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'A survey of string similarity' }));

    expect(onOpenAbstract).toHaveBeenCalledWith('doc-01');
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('toggles selection from the checkbox and marks the row with the ink ring', async () => {
    const user = userEvent.setup();
    renderPanel();

    const checkbox = await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
    await user.click(checkbox);

    expect(useSelectionStore.getState().selectedIds).toEqual(['doc-01']);
    expect(checkbox.closest('li')?.className).toContain('ring-[1.5px]');
  });

  it('filters rows by title, id or author, but never deselects a row hidden by the filter', async () => {
    const user = userEvent.setup();
    renderPanel();

    const checkbox = await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
    await user.click(checkbox);

    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'clustering');

    expectRowGone('A survey of string similarity');
    expect(
      screen.getByRole('checkbox', { name: 'Clustering theory refresher' }),
    ).toBeInTheDocument();
    // Still selected even though its row is currently filtered out.
    expect(useSelectionStore.getState().selectedIds).toEqual(['doc-01']);
  });

  it('filters rows by an id substring, case-insensitively', async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'DOC-03');

    expectRowGone('A survey of string similarity');
    expect(
      screen.getByRole('checkbox', { name: 'Clustering theory refresher' }),
    ).toBeInTheDocument();
  });

  it('filters rows by an author substring, case-insensitively', async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'three');

    expectRowGone('A survey of string similarity');
    expect(
      screen.getByRole('checkbox', { name: 'Embeddings for scientific text' }),
    ).toBeInTheDocument();
  });

  it('shows a quiet no-matches line when the search matches nothing', async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByRole('checkbox', { name: 'A survey of string similarity' });
    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'zzz-no-match');

    expect(screen.getByText('Sin coincidencias')).toBeInTheDocument();
  });

  describe('the article list states', () => {
    it('hides the loading sentence from sighted users but keeps it for screen readers, showing row skeletons instead', () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockReturnValue(new Promise(() => {}));

      renderPanel();

      // Scoped by its own text, not `getByRole('status')` alone: the
      // embeddings summary row has its own independent status while its
      // own fetch is still pending too.
      const status = screen.getByText('Cargando el corpus…');
      expect(status).toHaveAttribute('role', 'status');
      expect(status.className).toContain('sr-only');

      const skeleton = screen.getByTestId('corpus-list-skeleton');
      expect(skeleton.querySelectorAll('li')).toHaveLength(8);
      expect(within(skeleton).queryAllByRole('checkbox')).toHaveLength(0);
      expect(within(skeleton).queryAllByRole('button')).toHaveLength(0);
      for (const block of skeleton.querySelectorAll('[data-slot="skeleton"]')) {
        expect(block).toHaveAttribute('aria-hidden', 'true');
      }
    });

    it('holds no tab stop or region role while its rows are placeholders', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockReturnValue(new Promise(() => {}));

      renderPanel();

      const region = screen.getByTestId('corpus-list-skeleton').parentElement;
      expect(region).not.toHaveAttribute('tabindex');
      expect(region).not.toHaveAttribute('role');
      expect(region).toHaveClass('overflow-y-hidden');
      expect(focusableInSkeletons(document.body)).toEqual([]);
    });

    it('drops the scroll region role once real, focusable rows load', async () => {
      renderPanel();

      const scrollRegion = (
        await screen.findByRole('checkbox', {
          name: 'A survey of string similarity',
        })
      ).closest('.overflow-y-auto');

      expect(scrollRegion).not.toHaveAttribute('role');
      expect(scrollRegion).not.toHaveAttribute('tabindex');
    });

    it('shows an alert with the exact mapped error message when the corpus fails to load', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockRejectedValue({
        kind: 'network',
        cause: 'timeout',
        i18nKey: 'errors.network.coldStart',
      });

      renderPanel();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No se pudo cargar el corpus');
      expect(
        screen.getByText(
          'No se pudo contactar al servidor. Si es la primera solicitud en un rato, el servidor gratuito puede estar despertando: puede tardar hasta un minuto en responder.',
        ),
      ).toBeInTheDocument();
    });

    it('shows the empty-corpus message when the corpus has no articles, never the no-matches search line', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([]);

      renderPanel();

      expect(await screen.findByText('El corpus no tiene artículos cargados.')).toBeInTheDocument();
      expect(screen.queryByText('Sin coincidencias')).not.toBeInTheDocument();
    });
  });

  it('disables Limpiar with nothing selected, and clears the selection when enabled', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole('checkbox', { name: 'A survey of string similarity' });

    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'A survey of string similarity' }));
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  describe('the embeddings status summary', () => {
    it('shows a one-line embeddings summary that opens the embeddings detail on click', async () => {
      const user = userEvent.setup();
      const { onOpenEmbeddings } = renderPanel();

      const row = await screen.findByRole('button', { name: 'Ver el estado de los embeddings' });
      await expect.poll(() => row.textContent).toContain('Coincide con el corpus');

      await user.click(row);

      expect(onOpenEmbeddings).toHaveBeenCalledTimes(1);
    });

    it('reads "Revisar coincidencia" when either embedding family mismatches the corpus', async () => {
      vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockResolvedValue({
        ...EMBEDDINGS_STATUS,
        embeddingApi: { ...EMBEDDINGS_STATUS.embeddingApi, matchesCorpus: false },
      });

      renderPanel();

      const row = await screen.findByRole('button', { name: 'Ver el estado de los embeddings' });
      await expect.poll(() => row.textContent).toContain('Revisar coincidencia');
    });

    it('shows a placeholder value, never a claimed match, while the status is still pending', () => {
      vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockReturnValue(new Promise(() => {}));

      renderPanel();

      const row = screen.getByRole('button', { name: 'Ver el estado de los embeddings' });
      expect(row).not.toHaveTextContent('Coincide con el corpus');
      expect(row).not.toHaveTextContent('Cargando');
      expect(row.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    });

    it('the pure state helper never claims a match for absent data — an honest "unknown", not the corpus-matches default', () => {
      expect(embeddingsSummaryState(undefined)).toBe('unknown');
    });

    it('announces a hidden loading sentence for the inline embeddings value while it is still pending', async () => {
      let resolveStatus: (value: typeof EMBEDDINGS_STATUS) => void = () => {};
      vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockReturnValue(
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
      );

      renderPanel();

      const status = screen.getByText(es.corpus.rail.embeddings.loading);
      expect(status).toHaveAttribute('role', 'status');
      expect(status.className).toContain('sr-only');

      resolveStatus(EMBEDDINGS_STATUS);
      await waitFor(() =>
        expect(screen.queryByText(es.corpus.rail.embeddings.loading)).not.toBeInTheDocument(),
      );
    });

    it('contains an embeddings-status failure to its own summary — the article list still renders, without raising an alert', async () => {
      vi.spyOn(embeddingsApi, 'fetchEmbeddingsStatus').mockRejectedValue({
        kind: 'network',
        cause: 'timeout',
        i18nKey: 'errors.network.coldStart',
      });

      renderPanel();

      // Re-query the row on every poll instead of asserting on one node
      // captured up front, and assert the exact localized value the
      // component renders through `t('corpus.rail.embeddings.errorValue')`
      // — not a hand-typed guess at the copy.
      await expect
        .poll(() => screen.getByRole('button', { name: 'Ver el estado de los embeddings' }))
        .toHaveTextContent(es.corpus.rail.embeddings.errorValue);

      expect(
        await screen.findByRole('button', { name: 'A survey of string similarity' }),
      ).toBeInTheDocument();
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });
  });
});
