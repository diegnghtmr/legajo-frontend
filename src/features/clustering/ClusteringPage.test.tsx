import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClusteringResponse } from '../../infrastructure/api/clustering';
import * as clusteringApi from '../../infrastructure/api/clustering';
import * as corpusApi from '../../infrastructure/api/corpus';
import type { ListCorpusResponse } from '../../infrastructure/api/corpus';
import type { LinkageId } from '../../infrastructure/schemas/clustering';
import { ClusteringPage } from './ClusteringPage';

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
 * Golden n = 6 linkage matrix (TRD §6.4 conventions), shared by every
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

function linkageResult(
  linkageId: LinkageId,
  displayName: string,
  cophenetic: number,
  silhouetteAtKRef: number,
  dbAtKRef: number | null,
): ClusteringResponse[number] {
  return {
    linkageId,
    linkageDisplayName: displayName,
    rows: GOLDEN_ROWS_N6,
    leafOrder: [0, 1, 2, 3, 4, 5],
    evaluation: {
      cophenetic,
      meanSilhouette: { '2': 0.15, '3': 0.25, '4': silhouetteAtKRef, '5': 0.35 },
      daviesBouldin: { '2': 0.6, '3': 0.5, '4': dbAtKRef, '5': 0.4 },
    },
  };
}

/**
 * Builds a linkage result whose `leafOrder` length (n) and per-k metrics are
 * fully explicit — used by the R3-001 tests, where n itself (not just k_ref's
 * metrics) is the thing under test. `rows` stays empty on purpose: these
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
});

describe('ClusteringPage', () => {
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

    const singlePanel = await screen.findByTestId('linkage-panel-single');
    expect(within(singlePanel).getByText('Árbol')).toBeInTheDocument();

    const completePanel = screen.getByTestId('linkage-panel-complete');
    expect(within(completePanel).getByText('Partición')).toBeInTheDocument();

    expect(screen.getByText(/n = 6/)).toBeInTheDocument();
  });

  it('shows "no definido" for a null Davies-Bouldin value', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

    renderPage();

    const wardPanel = await screen.findByTestId('linkage-panel-ward');
    expect(within(wardPanel).getByText('no definido')).toBeInTheDocument();
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

  it('ranks at k_ref derived from the response itself, not a stale corpus-query size (R3-001)', async () => {
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

    const completePanel = await screen.findByTestId('linkage-panel-complete');
    expect(within(completePanel).getByText('Árbol')).toBeInTheDocument();

    const singlePanel = screen.getByTestId('linkage-panel-single');
    expect(within(singlePanel).getByText('Partición')).toBeInTheDocument();

    expect(screen.getByText(/n = 4/)).toBeInTheDocument();
  });

  it('shows no leader marks and the "requires all four" explanation when linkages disagree on n (R3-001)', async () => {
    vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
    vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue([
      linkageResultWithN('single', 'Single', 6, 0.95, { '4': 0.2 }, { '4': 0.5 }),
      linkageResultWithN('complete', 'Complete', 5, 0.5, { '4': 0.9 }, { '4': 0.1 }),
      linkageResultWithN('average', 'Average', 6, 0.4, { '4': 0.3 }, { '4': 0.2 }),
      linkageResultWithN('ward', 'Ward', 6, 0.3, { '4': 0.1 }, { '4': null }),
    ]);

    renderPage();

    await screen.findByTestId('linkage-panel-single');
    expect(
      screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
    expect(screen.queryByText('Partición')).not.toBeInTheDocument();
    expect(screen.queryByText('Líder')).not.toBeInTheDocument();
  });

  it('shows no leader marks and the "requires all four" explanation for a duplicate/non-canonical linkage id (R3-001)', async () => {
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
    expect(screen.queryByText('Líder')).not.toBeInTheDocument();
  });

  it('shows no leader marks and the "requires all four" explanation when the user deselected a linkage (R3-002)', async () => {
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

    expect(
      await screen.findByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
    expect(screen.queryByText('Partición')).not.toBeInTheDocument();
    expect(screen.queryByText('Líder')).not.toBeInTheDocument();
  });

  describe('the free cut', () => {
    it('renders the cut form bounded by n once the clustering response has loaded', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);

      renderPage();

      expect(
        await screen.findByRole('radiogroup', { name: 'Enlace a cortar' }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Número de clústeres k (entre 2 y 5)')).toBeInTheDocument();
    });

    it('submits {representation, linkage, k} and shows the cluster labels and cut line only on that linkage after success', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 3,
      });
      const user = userEvent.setup();

      renderPage();
      await waitFor(() => expect(clusteringApi.runClustering).toHaveBeenCalled());

      const cutGroup = await screen.findByRole('radiogroup', { name: 'Enlace a cortar' });
      await user.click(within(cutGroup).getByRole('radio', { name: 'Complete' }));

      const kInput = screen.getByLabelText('Número de clústeres k (entre 2 y 5)');
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
      expect(within(completeDendrogram).getAllByText('Clúster 0')).toHaveLength(2);

      const singleDendrogram = screen.getByTestId('linkage-dendrogram-single');
      expect(within(singleDendrogram).queryByTestId('dendrogram-cut-line')).not.toBeInTheDocument();
    });

    it('clears a previous cut result once the representation changes (it was computed against a different request)', async () => {
      vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue(CORPUS);
      vi.spyOn(clusteringApi, 'runClustering').mockResolvedValue(DEFAULT_RESPONSE);
      vi.spyOn(clusteringApi, 'cutClustering').mockResolvedValue({
        labels: [0, 0, 1, 1, 2, 2],
        k: 3,
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
  });
});
