import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ClusteringCutResponse,
  ClusteringResponse,
} from '../../infrastructure/api/clustering';
import { stubLaidOutWidth } from '../../test/layout';
import * as clusteringApi from '../../infrastructure/api/clustering';
import * as corpusApi from '../../infrastructure/api/corpus';
import type { ListCorpusResponse } from '../../infrastructure/api/corpus';
import type { LinkageId } from '../../infrastructure/schemas/clustering';
import { ClusteringPage } from './ClusteringPage';
import { dendrogramCardHeight } from './dendrogramGridSizing';

vi.mock('../../infrastructure/api/clustering');
vi.mock('../../infrastructure/api/corpus');

const ALL_FOUR: readonly LinkageId[] = ['single', 'complete', 'average', 'ward'];

/** 6 documents -> k_ref = min(4, 6-1) = 4. */
const CORPUS: ListCorpusResponse = Array.from({ length: 6 }, (_unused, index) => ({
  id: `doc-0${index + 1}`,
  title: `Article ${index + 1}`,
  authors: ['A. Author'],
}));

/**
 * Golden n = 6 linkage matrix, shared by every
 * `linkageResult()` fixture below so the real `Dendrogram` this page now
 * renders always has a well-formed matrix to draw — the same shape
 * `dendrogramLayout.test.ts` validates on its own.
 */
const GOLDEN_ROWS_N6 = [
  { idx1: 0, idx2: 1, mergeDistance: 0.1, size: 2 },
  { idx1: 2, idx2: 3, mergeDistance: 0.2, size: 2 },
  { idx1: 4, idx2: 5, mergeDistance: 0.3, size: 2 },
  { idx1: 6, idx2: 7, mergeDistance: 0.4, size: 4 },
  { idx1: 8, idx2: 9, mergeDistance: 0.5, size: 6 },
];

/** Same order as `CORPUS` (position i is `CORPUS[i]`), the common case. */
const DOCUMENT_IDS_N6 = CORPUS.map((document) => document.id);

function linkageResult(
  linkageId: LinkageId,
  displayName: string,
  cophenetic: number,
  silhouetteAtKRef: number,
  dbAtKRef: number | null,
  documentIds: readonly string[] = DOCUMENT_IDS_N6,
): ClusteringResponse[number] {
  return {
    linkageId,
    linkageDisplayName: displayName,
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: [...documentIds],
    evaluation: {
      cophenetic,
      meanSilhouette: { '2': 0.15, '3': 0.25, '4': silhouetteAtKRef, '5': 0.35 },
      daviesBouldin: { '2': 0.6, '3': 0.5, '4': dbAtKRef, '5': 0.4 },
    },
  };
}

/**
 * Builds a linkage result whose `leafOrder` length (n) and per-k metrics are
 * fully explicit — used by the ranking-degradation tests below, where n
 * itself (not just k_ref's metrics) is the thing under test. `rows` stays
 * empty on purpose: these
 * tests exercise the ranking degradation path, never the dendrogram itself,
 * so a malformed (empty) matrix here is inert — `Dendrogram` degrades to its
 * own translated error, which none of these tests assert against.
 */
function linkageResultWithN(
  linkageId: LinkageId,
  displayName: string,
  sampleSize: number,
  cophenetic: number,
  meanSilhouette: Record<string, number>,
  daviesBouldin: Record<string, number | null>,
): ClusteringResponse[number] {
  return {
    linkageId,
    linkageDisplayName: displayName,
    rows: [],
    leafOrder: Array.from({ length: sampleSize }, (_unused, index) => index),
    documentIds: Array.from({ length: sampleSize }, (_unused, index) => `doc-n-${index + 1}`),
    evaluation: { cophenetic, meanSilhouette, daviesBouldin },
  };
}

/**
 * single wins cophenetic alone (no tie); complete has the highest silhouette
 * at k_ref=4, so the two leaders differ — the same shape as the backend's
 * own `picksTheSoleCopheneticLeaderWhenThereIsNoTie` golden case.
 */
const DEFAULT_RESPONSE: ClusteringResponse = [
  linkageResult('single', 'Single', 0.95, 0.2, 0.5),
  linkageResult('complete', 'Complete', 0.5, 0.9, 0.1),
  linkageResult('average', 'Average', 0.4, 0.3, 0.2),
  linkageResult('ward', 'Ward', 0.3, 0.1, null),
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      {(<ClusteringPage />) as ReactNode}
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  stubLaidOutWidth(640);
});

describe('ClusteringPage', () => {
  // These three assertions (control bar card, dendrogram grid, cut-unavailable
  // placeholder) were written after the layout wiring above rather than
  // before it; disclosed here rather than claiming an observed RED that
  // never happened, the same disclosure this file's own history already
  // uses for its URL-state assertions.
  it('keeps the representation, linkage selection and free cut together in one parameter panel card', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    const representationGroup = screen.getByRole('radiogroup', { name: 'Representación' });
    const linkageGroup = screen.getByRole('group', { name: 'Selección de enlaces' });
    const cutGroup = await screen.findByRole('radiogroup', { name: 'Enlace a cortar' });

    const card = representationGroup.closest('section');
    expect(card).not.toBeNull();
    expect(card as HTMLElement).toContainElement(linkageGroup);
    expect(card as HTMLElement).toContainElement(cutGroup);
  });

  it('lays the dendrogram cards out in a grid that goes to two columns from lg', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    const dendrogramCard = await screen.findByTestId('linkage-dendrogram-single');
    expect(dendrogramCard.parentElement).toHaveClass('grid', 'grid-cols-1', 'lg:grid-cols-2');
  });

  it('shows a cut-form skeleton before the clustering response resolves, never an empty gap or the still-loading text', () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockImplementation(() => new Promise(() => {}));

    renderPage();

    // The real form's own responsive row (segmented control, k field,
    // submit button), reserved before the request resolves — never the
    // "still loading" text this replaced, which stayed the same fixed
    // height regardless of viewport while the real form's own height
    // changes once its three fields wrap.
    expect(
      screen.queryByText('El corte estará disponible cuando termine de cargar el agrupamiento.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Enlace a cortar' })).not.toBeInTheDocument();
    expect(screen.getByText('Enlace a cortar')).toBeInTheDocument();
    // The segmented control's own placeholder segments, scoped to the
    // group below its label (never the page's own, real linkage-selection
    // buttons elsewhere, which carry the same mono ids).
    const segmentedGroup = screen.getByText('Enlace a cortar').parentElement;
    for (const linkageId of ALL_FOUR) {
      expect(segmentedGroup).toHaveTextContent(linkageId);
    }
  });

  it('shows a metrics-table skeleton row and a dendrogram card skeleton per selected linkage while the clustering request is pending, sized from the corpus response', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockImplementation(() => new Promise(() => {}));

    renderPage();

    const status = screen.getByText('Calculando el agrupamiento…');
    expect(status).toHaveAttribute('role', 'status');
    expect(status.className).toContain('sr-only');

    for (const linkageId of ALL_FOUR) {
      expect(screen.getByTestId(`metrics-row-skeleton-${linkageId}`)).toBeInTheDocument();
      const card = screen.getByTestId(`linkage-dendrogram-skeleton-${linkageId}`);
      // Waits for the corpus fetch (mocked resolved, but still async) to
      // settle, so the height reflects its own 6-document response rather
      // than the pre-resolution default.
      await waitFor(() => {
        const block = card.querySelector(
          '[data-testid="dendrogram-skeleton-chart"]',
        ) as HTMLElement | null;
        expect(block?.style.height).toBe(`${dendrogramCardHeight(6)}px`);
      });
    }
  });

  it('defaults the dendrogram skeleton height to a corpus of 20 when the corpus query has not resolved yet', () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockReturnValue(new Promise(() => {}));
    vi.spyOn(clusteringApi, 'runClustering').mockImplementation(() => new Promise(() => {}));

    renderPage();

    const card = screen.getByTestId('linkage-dendrogram-skeleton-single');
    const block = card.querySelector(
      '[data-testid="dendrogram-skeleton-chart"]',
    ) as HTMLElement | null;
    expect(block).not.toBeNull();
    expect(block?.style.height).toBe(`${dendrogramCardHeight(20)}px`);
  });

  it('shows a distinct cut-unavailable reason when the clustering request fails, never the "still loading" placeholder', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockRejectedValue({
      kind: 'unexpected',
      i18nKey: 'errors.unexpected',
      message: 'boom',
    });

    renderPage();

    expect(
      await screen.findByText('El corte no está disponible porque el agrupamiento falló.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('El corte estará disponible cuando termine de cargar el agrupamiento.'),
    ).not.toBeInTheDocument();
  });

  it('shows a distinct cut-unavailable reason when no linkage is selected, never the "still loading" placeholder', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());

    for (const id of ALL_FOUR) {
      await user.click(screen.getByRole('button', { name: id }));
    }

    expect(
      await screen.findByText(
        'El corte no está disponible porque no hay ningún enlace seleccionado.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('El corte estará disponible cuando termine de cargar el agrupamiento.'),
    ).not.toBeInTheDocument();
  });

  it('requests tfidf-cosine and all four linkages by default', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    expect(screen.getByRole('heading', { name: 'Agrupamiento jerárquico' })).toBeInTheDocument();
    await waitFor(() =>
      expect(clusteringApi.runClustering).toHaveBeenCalledWith({
        representation: 'tfidf-cosine',
        linkages: [...ALL_FOUR],
      }),
    );
  });

  it('re-requests when the representation changes', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());

    const group = screen.getByRole('radiogroup', { name: 'Representación' });
    await user.click(within(group).getByRole('radio', { name: 'embedding-local' }));

    await waitFor(() =>
      expect(clusteringApi.runClustering).toHaveBeenLastCalledWith({
        representation: 'embedding-local',
        linkages: [...ALL_FOUR],
      }),
    );
  });

  it('with every linkage deselected, shows the reason and sends no request with an empty linkages array', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());

    for (const id of ALL_FOUR) {
      await user.click(screen.getByRole('button', { name: id }));
    }

    expect(
      await screen.findByText('Selecciona al menos un enlace para agrupar.'),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(clusteringApi.runClustering)
        .mock.calls.some(([request]) => request?.linkages?.length === 0),
    ).toBe(false);
  });

  it('marks the cophenetic leader, shows the Tree/Partition eyebrows when leaders differ, and the sample-size caveat', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    const singleRow = await screen.findByTestId('metrics-row-single');
    expect(within(singleRow).getByText('Árbol')).toBeInTheDocument();

    const completeRow = screen.getByTestId('metrics-row-complete');
    expect(within(completeRow).getByText('Partición')).toBeInTheDocument();

    expect(screen.getByText(/Tamaño muestral del corpus cargado: n = 6/)).toBeInTheDocument();
  });

  it('shows "no definido" for a null Davies-Bouldin value', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    const wardRow = await screen.findByTestId('metrics-row-ward');
    expect(within(wardRow).getByText('no definido')).toBeInTheDocument();
  });

  it('marks the cophenetic tie set when its size is greater than one', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue([
      linkageResult('single', 'Single', 0.901, 0.5, 0.3),
      linkageResult('complete', 'Complete', 0.9005, 0.7, 0.25),
      linkageResult('average', 'Average', 0.8, 0.4, 0.2),
      linkageResult('ward', 'Ward', 0.9008, 0.6, 0.28),
    ]);

    renderPage();

    expect(await screen.findByText(/single, complete, ward/)).toBeInTheDocument();
  });

  it('shows the mapped error message when the clustering request fails', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockRejectedValue({
      kind: 'unexpected',
      i18nKey: 'errors.unexpected',
      message: 'boom',
    });

    renderPage();

    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
  });

  it('explains a failed clustering request with the problem detail and retries it from the alert', async () => {
    const user = userEvent.setup();
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    const run = vi
      .spyOn(clusteringApi, 'runClustering')
      .mockRejectedValueOnce({
        kind: 'problem',
        status: 400,
        title: 'Bad Request',
        detail: 'Unknown representation: bogus.',
        i18nKey: 'errors.unknownRepresentation',
      })
      .mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unknown representation: bogus.');
    expect(alert).toHaveTextContent('POST /api/v1/clustering');
    expect(alert).toHaveTextContent('HTTP 400');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('renders an accessible dendrogram for each linkage, in its own dendrogram container', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    for (const { linkageId, linkageDisplayName } of DEFAULT_RESPONSE) {
      const container = await screen.findByTestId(`linkage-dendrogram-${linkageId}`);
      expect(within(container).getByRole('img')).toHaveAccessibleName(
        `Dendrograma de ${linkageDisplayName}`,
      );
    }
  });

  describe('dendrogram leaf labels (W-documentIds)', () => {
    it('joins each leaf to its title by document id, not by its position in GET /corpus (documentIds order differs from the corpus list order)', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      // Reversed relative to CORPUS/DOCUMENT_IDS_N6: leaf id 5 is now doc-01
      // ("Article 1"), not doc-06 ("Article 6") -- an index-based lookup
      // into the corpus list would show "Article 6" for leaf 5 instead.
      const reversedDocumentIds = [...DOCUMENT_IDS_N6].reverse();
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue([
        linkageResult('single', 'Single', 0.95, 0.2, 0.5, reversedDocumentIds),
      ]);

      renderPage();

      const dendrogram = await screen.findByTestId('linkage-dendrogram-single');
      const leafFive = dendrogram.querySelector('[data-leaf-id="5"]');
      expect(leafFive).not.toBeNull();
      expect(within(leafFive as HTMLElement).getByText('doc-01')).toBeInTheDocument();
      expect(leafFive?.querySelector('title')?.textContent).toBe('Article 1');
    });

    it('still labels every leaf with its document id (no title) when the GET /corpus fetch fails, never a numeric-index guess', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockRejectedValue({
        kind: 'unexpected',
        i18nKey: 'errors.unexpected',
        message: 'boom',
      });
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue([
        linkageResult('single', 'Single', 0.95, 0.2, 0.5),
      ]);

      renderPage();

      const dendrogram = await screen.findByTestId('linkage-dendrogram-single');
      await waitFor(() => expect(corpusApi.fetchCorpus).toHaveBeenCalled());

      const leafZero = dendrogram.querySelector('[data-leaf-id="0"]');
      expect(leafZero).not.toBeNull();
      await waitFor(() =>
        expect(
          within(leafZero as HTMLElement).getByText('doc-01', { selector: 'text' }),
        ).toBeInTheDocument(),
      );
      // Not a numeric-index fallback ("0"), and no title without a resolved corpus.
      expect(leafZero?.querySelector('title')?.textContent).toBe('doc-01');
    });
  });

  it('ranks at k_ref derived from the response itself, not a stale corpus-query size', async () => {
    // Corpus query reports 20 documents -> would have implied k_ref =
    // min(4, 19) = 4 under the old (wrong) source. The response's own
    // leafOrder length is 4 -> the correct k_ref is min(4, 4-1) = 3.
    // At k_ref=3, "single" leads the silhouette (partition); "complete" is
    // the unique cophenetic (tree) leader. Ranking at the stale k_ref=4
    // would instead make "complete" the partition leader too (leadersDiffer
    // = false), so the "Árbol"/"Partición" split only appears when k_ref=3
    // is actually used.
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(
      Array.from({ length: 20 }, (_unused, index) => ({
        id: `doc-${index + 1}`,
        title: `Article ${index + 1}`,
        authors: ['A. Author'],
      })),
    );
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue([
      linkageResultWithN(
        'single',
        'Single',
        4,
        0.3,
        { '2': 0.1, '3': 0.9, '4': 0.05 },
        { '2': 0.5, '3': 0.5, '4': 0.5 },
      ),
      linkageResultWithN(
        'complete',
        'Complete',
        4,
        0.95,
        { '2': 0.1, '3': 0.1, '4': 0.99 },
        { '2': 0.5, '3': 0.5, '4': 0.5 },
      ),
      linkageResultWithN(
        'average',
        'Average',
        4,
        0.2,
        { '2': 0.1, '3': 0.2, '4': 0.2 },
        { '2': 0.5, '3': 0.5, '4': 0.5 },
      ),
      linkageResultWithN(
        'ward',
        'Ward',
        4,
        0.1,
        { '2': 0.1, '3': 0.05, '4': 0.1 },
        { '2': 0.5, '3': 0.5, '4': 0.5 },
      ),
    ]);

    renderPage();

    const completeRow = await screen.findByTestId('metrics-row-complete');
    expect(within(completeRow).getByText('Árbol')).toBeInTheDocument();

    const singleRow = screen.getByTestId('metrics-row-single');
    expect(within(singleRow).getByText('Partición')).toBeInTheDocument();

    expect(screen.getByText(/Tamaño muestral del corpus cargado: n = 4/)).toBeInTheDocument();
  });

  it('shows no leader marks and the "requires all four" explanation when linkages disagree on n', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue([
      linkageResultWithN('single', 'Single', 6, 0.95, { '4': 0.2 }, { '4': 0.5 }),
      linkageResultWithN('complete', 'Complete', 5, 0.5, { '4': 0.9 }, { '4': 0.1 }),
      linkageResultWithN('average', 'Average', 6, 0.4, { '4': 0.3 }, { '4': 0.2 }),
      linkageResultWithN('ward', 'Ward', 6, 0.3, { '4': 0.1 }, { '4': null }),
    ]);

    renderPage();

    await screen.findByTestId('linkage-dendrogram-single');
    expect(
      screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
    expect(screen.queryByText('Partición')).not.toBeInTheDocument();
  });

  it('shows no leader marks and the "requires all four" explanation for a duplicate/non-canonical linkage id', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue([
      linkageResultWithN('single', 'Single A', 6, 0.95, { '4': 0.2 }, { '4': 0.5 }),
      linkageResultWithN('single', 'Single B', 6, 0.5, { '4': 0.9 }, { '4': 0.1 }),
      linkageResultWithN('average', 'Average', 6, 0.4, { '4': 0.3 }, { '4': 0.2 }),
      linkageResultWithN('complete', 'Complete', 6, 0.3, { '4': 0.1 }, { '4': null }),
    ]);

    renderPage();

    await screen.findByTestId('linkage-dendrogram-average');
    expect(
      screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
    expect(screen.queryByText('Partición')).not.toBeInTheDocument();
  });

  it('shows no leader marks and the "requires all four" explanation when the user deselected a linkage', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());

    vi.mocked(clusteringApi.runClustering).mockResolvedValue(
      DEFAULT_RESPONSE.filter((result) => result.linkageId !== 'ward'),
    );
    await user.click(screen.getByRole('button', { name: 'ward' }));

    await waitFor(() =>
      expect(clusteringApi.runClustering).toHaveBeenLastCalledWith({
        representation: 'tfidf-cosine',
        linkages: ['single', 'complete', 'average'],
      }),
    );

    // Said twice: as the linkage-selection hint and under the metrics table.
    expect(
      await screen.findAllByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
    ).toHaveLength(2);
    expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
    expect(screen.queryByText('Partición')).not.toBeInTheDocument();
  });

  describe('the free cut', () => {
    it('renders the cut form bounded by n once the clustering response has loaded', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

      renderPage();

      expect(
        await screen.findByRole('radiogroup', { name: 'Enlace a cortar' }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('k: entre 2 y 5')).toBeInTheDocument();
    });

    it('submits {representation, linkage, k} and shows the cluster labels and cut line only on that linkage after success', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 3,
        documentIds: DOCUMENT_IDS_N6,
      });
      const user = userEvent.setup();

      renderPage();
      await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());

      const cutGroup = await screen.findByRole('radiogroup', { name: 'Enlace a cortar' });
      await user.click(within(cutGroup).getByRole('radio', { name: 'Complete' }));

      const kInput = screen.getByLabelText('k: entre 2 y 5');
      await user.clear(kInput);
      await user.type(kInput, '3');
      await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

      await waitFor(() =>
        expect(clusteringApi.cutClustering).toHaveBeenCalledWith({
          representation: 'tfidf-cosine',
          linkage: 'complete',
          k: 3,
        }),
      );

      const completeDendrogram = await screen.findByTestId('linkage-dendrogram-complete');
      expect(within(completeDendrogram).getByTestId('dendrogram-cut-line')).toBeInTheDocument();
      expect(
        within(completeDendrogram).getAllByText('0', {
          selector: '[data-testid="cluster-marker"]',
        }),
      ).toHaveLength(2);

      const singleDendrogram = screen.getByTestId('linkage-dendrogram-single');
      expect(within(singleDendrogram).queryByTestId('dendrogram-cut-line')).not.toBeInTheDocument();
    });

    it('resolves the cut labels by document id, not by array position, when the cut response documentIds order differs from the linkage result', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        // Reversed relative to the "single" linkage's own `documentIds`
        // (DOCUMENT_IDS_N6): the cut request computes its own pairing and
        // is never guaranteed to share array positions with any linkage.
        documentIds: [...DOCUMENT_IDS_N6].reverse(),
        k: 3,
      });
      const user = userEvent.setup();

      renderPage();
      await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());
      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));

      const singleDendrogram = await screen.findByTestId('linkage-dendrogram-single');
      await waitFor(() =>
        expect(within(singleDendrogram).getByTestId('dendrogram-cut-line')).toBeInTheDocument(),
      );

      // Leaf id 0 is DOCUMENT_IDS_N6[0] ("doc-01"), which sits LAST in the
      // cut response's own (reversed) documentIds -> its label is 2. A join
      // by array position would wrongly read labels[0] = 0 for this leaf.
      const leafZero = singleDendrogram.querySelector('[data-leaf-id="0"]') as HTMLElement;
      expect(leafZero).not.toBeNull();
      expect(
        within(leafZero).getByText('2', { selector: '[data-testid="cluster-marker"]' }),
      ).toBeInTheDocument();
      expect(
        within(leafZero).queryByText('0', { selector: '[data-testid="cluster-marker"]' }),
      ).not.toBeInTheDocument();
    });

    it('clears a previous cut result once the representation changes (it was computed against a different request)', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 3,
        documentIds: DOCUMENT_IDS_N6,
      });
      const user = userEvent.setup();

      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));

      const singleDendrogram = await screen.findByTestId('linkage-dendrogram-single');
      await waitFor(() =>
        expect(within(singleDendrogram).getByTestId('dendrogram-cut-line')).toBeInTheDocument(),
      );

      const representationGroup = screen.getByRole('radiogroup', { name: 'Representación' });
      await user.click(within(representationGroup).getByRole('radio', { name: 'embedding-local' }));

      await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalledTimes(2));
      const refreshedSingleDendrogram = await screen.findByTestId('linkage-dendrogram-single');
      expect(
        within(refreshedSingleDendrogram).queryByTestId('dendrogram-cut-line'),
      ).not.toBeInTheDocument();
    });

    it('still shows the cut labels and no cut line when the response k cannot be resolved to a distance for the loaded rows', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      // GOLDEN_ROWS_N6 has 5 rows -> n=6, so k must be in [2, 5]; k=10 is
      // out of range for those rows even though the request succeeded.
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 10,
        documentIds: DOCUMENT_IDS_N6,
      });
      const user = userEvent.setup();

      renderPage();
      await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());

      const cutGroup = await screen.findByRole('radiogroup', { name: 'Enlace a cortar' });
      await user.click(within(cutGroup).getByRole('radio', { name: 'Complete' }));
      await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

      const completeDendrogram = await screen.findByTestId('linkage-dendrogram-complete');
      await waitFor(() =>
        expect(
          within(completeDendrogram).getAllByText('0', {
            selector: '[data-testid="cluster-marker"]',
          }),
        ).toHaveLength(2),
      );
      expect(
        within(completeDendrogram).queryByTestId('dendrogram-cut-line'),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the mapped invalid-cut error message when the cut request fails', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockRejectedValue({
        kind: 'problem',
        status: 400,
        type: 'urn:legajo:problem:invalid-cut',
        title: 'Invalid cut',
        i18nKey: 'errors.invalidCut',
      });
      const user = userEvent.setup();

      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));

      expect(
        await screen.findByText('El valor de corte k no es válido para este corpus.'),
      ).toBeInTheDocument();
    });

    it('stops showing a previous cut error once the representation changes', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockRejectedValue({
        kind: 'problem',
        status: 400,
        type: 'urn:legajo:problem:invalid-cut',
        title: 'Invalid cut',
        i18nKey: 'errors.invalidCut',
      });
      const user = userEvent.setup();

      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));

      expect(
        await screen.findByText('El valor de corte k no es válido para este corpus.'),
      ).toBeInTheDocument();

      const representationGroup = screen.getByRole('radiogroup', { name: 'Representación' });
      await user.click(within(representationGroup).getByRole('radio', { name: 'embedding-local' }));

      await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalledTimes(2));
      expect(
        screen.queryByText('El valor de corte k no es válido para este corpus.'),
      ).not.toBeInTheDocument();
    });

    it('stops showing a previous cut error once a linkage is toggled', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockRejectedValue({
        kind: 'problem',
        status: 400,
        type: 'urn:legajo:problem:invalid-cut',
        title: 'Invalid cut',
        i18nKey: 'errors.invalidCut',
      });
      const user = userEvent.setup();

      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));

      expect(
        await screen.findByText('El valor de corte k no es válido para este corpus.'),
      ).toBeInTheDocument();

      vi.mocked(clusteringApi.runClustering).mockResolvedValue(
        DEFAULT_RESPONSE.filter((result) => result.linkageId !== 'ward'),
      );
      await user.click(screen.getByRole('button', { name: 'ward' }));

      await waitFor(() =>
        expect(clusteringApi.runClustering).toHaveBeenLastCalledWith({
          representation: 'tfidf-cosine',
          linkages: ['single', 'complete', 'average'],
        }),
      );
      expect(
        screen.queryByText('El valor de corte k no es válido para este corpus.'),
      ).not.toBeInTheDocument();
    });

    it('attributes a cut result to the linkages selected at submit time, never to a selection toggled while the request is still in flight', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      let resolveCut: (value: ClusteringCutResponse) => void = () => {
        throw new Error('resolveCut called before cutClustering was invoked');
      };
      vi.spyOn(clusteringApi, 'cutClustering').mockImplementation(
        () =>
          new Promise<ClusteringCutResponse>((resolve) => {
            resolveCut = resolve;
          }),
      );
      const user = userEvent.setup();

      renderPage();
      await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());

      // Submit the free cut against the current (all four linkages) selection;
      // the default cut linkage is the first one, "single".
      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));
      await waitFor(() => expect(clusteringApi.cutClustering).toHaveBeenCalled());

      // While that request is still pending, deselect "ward".
      vi.mocked(clusteringApi.runClustering).mockResolvedValue(
        DEFAULT_RESPONSE.filter((result) => result.linkageId !== 'ward'),
      );
      await user.click(screen.getByRole('button', { name: 'ward' }));
      await waitFor(() =>
        expect(clusteringApi.runClustering).toHaveBeenLastCalledWith({
          representation: 'tfidf-cosine',
          linkages: ['single', 'complete', 'average'],
        }),
      );

      // Now resolve the in-flight cut — computed against the *original*
      // four-linkage selection, which no longer matches the page's current
      // selection.
      resolveCut({ labels: [0, 0, 1, 1, 2, 2], k: 3, documentIds: DOCUMENT_IDS_N6 });

      const singleDendrogram = await screen.findByTestId('linkage-dendrogram-single');
      await waitFor(() =>
        expect(
          within(singleDendrogram).queryByTestId('dendrogram-cut-line'),
        ).not.toBeInTheDocument(),
      );
      expect(
        within(singleDendrogram).queryByText('0', { selector: '[data-testid="cluster-marker"]' }),
      ).not.toBeInTheDocument();
    });

    it('sends the k edited with the stepper buttons', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 4,
        documentIds: DOCUMENT_IDS_N6,
      });
      const user = userEvent.setup();

      renderPage();
      await screen.findByLabelText('k: entre 2 y 5');
      await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
      await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
      await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

      await waitFor(() =>
        expect(clusteringApi.cutClustering).toHaveBeenCalledWith({
          representation: 'tfidf-cosine',
          linkage: 'single',
          k: 4,
        }),
      );
    });

    it('names the applied cut in the status footer, marks the controls applied and disables the button until they change', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 3,
        documentIds: DOCUMENT_IDS_N6,
      });
      const user = userEvent.setup();

      renderPage();
      await screen.findByLabelText('k: entre 2 y 5');
      const footer = screen.getByTestId('params-status-footer');
      expect(footer).toHaveTextContent('Sin corte aplicado');

      await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
      await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));

      await waitFor(() => expect(footer).toHaveTextContent('Corte en single, k = 3'));
      expect(screen.getByText('aplicado')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
      expect(screen.queryByText('aplicado')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeEnabled();
    });

    it('removes the cut with "Quitar corte": the cut line and the cluster numbers go, the controls stay', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 3,
        documentIds: DOCUMENT_IDS_N6,
      });
      const user = userEvent.setup();

      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));
      const singleDendrogram = await screen.findByTestId('linkage-dendrogram-single');
      await waitFor(() =>
        expect(within(singleDendrogram).getByTestId('dendrogram-cut-line')).toBeInTheDocument(),
      );

      await user.click(screen.getByRole('button', { name: 'Quitar corte' }));

      expect(
        within(screen.getByTestId('linkage-dendrogram-single')).queryByTestId(
          'dendrogram-cut-line',
        ),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('params-status-footer')).toHaveTextContent('Sin corte aplicado');
      expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeEnabled();
    });
  });

  it('lists n and k_ref in the status footer once the response has loaded', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    const footer = await screen.findByTestId('params-status-footer');
    await waitFor(() => expect(footer).toHaveTextContent('n = 6'));
    expect(footer).toHaveTextContent('k_ref = 4');
  });

  it('selects all four linkages again with "Todos"', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'ward' }));
    await user.click(screen.getByRole('button', { name: 'complete' }));

    await user.click(screen.getByRole('button', { name: 'Todos' }));

    await waitFor(() =>
      expect(clusteringApi.runClustering).toHaveBeenLastCalledWith({
        representation: 'tfidf-cosine',
        linkages: ['single', 'complete', 'average', 'ward'],
      }),
    );
    expect(screen.queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument();
  });

  describe('the sticky summary bar', () => {
    let reportIntersection: (entry: {
      isIntersecting: boolean;
      boundingClientRect: { top: number };
    }) => void;

    beforeEach(() => {
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(callback: (entries: unknown[]) => void) {
            reportIntersection = (entry) => callback([entry]);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
      Element.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });

    it('stays hidden while the parameter panel is in view', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

      renderPage();
      await screen.findByTestId('params-status-footer');

      expect(
        screen.queryByRole('region', { name: 'Resumen de parámetros' }),
      ).not.toBeInTheDocument();
    });

    it('appears once the panel scrolls out of view and summarises the parameters and the applied cut', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 3,
        documentIds: DOCUMENT_IDS_N6,
      });
      const user = userEvent.setup();

      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));
      await screen.findByText('Corte en', { exact: false });

      act(() => reportIntersection({ isIntersecting: false, boundingClientRect: { top: -120 } }));

      const bar = await screen.findByRole('region', { name: 'Resumen de parámetros' });
      expect(bar).toHaveTextContent('tfidf-cosine');
      expect(bar).toHaveTextContent('single, complete, average, ward');
      expect(bar).toHaveTextContent('corte single k = 3');
    });

    it('"Editar" scrolls back to the panel and focuses its first control', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      const user = userEvent.setup();

      renderPage();
      await screen.findByTestId('params-status-footer');
      act(() => reportIntersection({ isIntersecting: false, boundingClientRect: { top: -120 } }));

      await user.click(await screen.findByRole('button', { name: 'Editar' }));

      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      expect(screen.getByRole('radio', { name: 'tfidf-cosine' })).toHaveFocus();
    });
  });

  describe('the dendrogram cards', () => {
    it('shows the cophenetic value as the subtitle and the leader badges as the actions', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

      renderPage();

      const single = await screen.findByTestId('linkage-dendrogram-single');
      expect(within(single).getByText('Cofenética 0.950')).toBeInTheDocument();
      expect(within(single).getByText('Árbol')).toBeInTheDocument();
      const complete = screen.getByTestId('linkage-dendrogram-complete');
      expect(within(complete).getByText('Partición')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('linkage-dendrogram-average')).queryByText('Árbol'),
      ).toBeNull();
    });

    it('previews the edited k on the card of the linkage to cut only', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      const user = userEvent.setup();

      renderPage();

      const single = await screen.findByTestId('linkage-dendrogram-single');
      expect(within(single).getByTestId('dendrogram-preview-label')).toHaveTextContent('k = 2');
      const complete = screen.getByTestId('linkage-dendrogram-complete');
      expect(within(complete).queryByTestId('dendrogram-preview-line')).toBeNull();

      await user.click(screen.getByRole('radio', { name: 'Complete' }));
      await user.click(screen.getByRole('button', { name: 'Aumentar k' }));

      expect(within(single).queryByTestId('dendrogram-preview-line')).toBeNull();
      expect(within(complete).getByTestId('dendrogram-preview-label')).toHaveTextContent('k = 3');
    });

    it('draws no preview for an invalid k', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      const user = userEvent.setup();

      renderPage();
      const field = await screen.findByLabelText('k: entre 2 y 5');
      await user.clear(field);
      await user.type(field, '9');

      expect(screen.queryByTestId('dendrogram-preview-line')).toBeNull();
    });

    it('swaps the preview for the applied cut once the controls match it, and marks the cut card with its k', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 2,
        documentIds: DOCUMENT_IDS_N6,
      });
      const user = userEvent.setup();

      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Aplicar corte' }));

      const single = await screen.findByTestId('linkage-dendrogram-single');
      await waitFor(() =>
        expect(within(single).getByTestId('dendrogram-cut-line')).toBeInTheDocument(),
      );
      expect(within(single).queryByTestId('dendrogram-preview-line')).toBeNull();
      expect(within(single).getByTestId('dendrogram-cut-chip')).toHaveTextContent('k = 2');
      expect(within(single).getAllByText('k = 2', { selector: 'span' }).length).toBeGreaterThan(0);

      await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
      expect(within(single).getByTestId('dendrogram-preview-label')).toHaveTextContent('k = 3');
      expect(within(single).getByTestId('dendrogram-cut-line')).toBeInTheDocument();
    });
  });
});
