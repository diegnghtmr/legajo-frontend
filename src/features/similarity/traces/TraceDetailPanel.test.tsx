import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as similarityApi from '../../../infrastructure/api/similarity';
import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../../infrastructure/api/similarity';
import es from '../../../infrastructure/i18n/locales/es.json';
import type { DpMatrixTrace, JaccardTrace } from '../../../infrastructure/schemas/similarity';
import { TraceDetailPanel } from './TraceDetailPanel';

vi.mock('../../../infrastructure/api/similarity');

const CATALOGUE: ListSimilarityAlgorithmsResponse = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
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
  operations: [{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 }, operation: 'SUBSTITUTION' }],
};

const JACCARD_TRACE: JaccardTrace = {
  algorithmId: 'jaccard',
  setA: ['a', 'b'],
  setB: ['b', 'c'],
  intersectionSize: 1,
  unionSize: 3,
  intersection: ['b'],
  union: ['a', 'b', 'c'],
  coefficient: 0.3333,
};

function singleCompareResultFor(algorithmId: string): CompareResponse {
  return [
    {
      algorithmId: algorithmId as CompareResponse[number]['algorithmId'],
      result: {
        normalizedScore: 0.75,
        rawValue: 12,
        computedNanos: 100,
        cached: false,
        degenerate: false,
      },
    },
  ];
}

function renderPanel(overrides: Partial<{ algorithmId: string; onClose: () => void }> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = overrides.onClose ?? vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TraceDetailPanel
          algorithmId={overrides.algorithmId ?? 'levenshtein'}
          documentIdA="doc-01"
          documentIdB="doc-02"
          onClose={onClose}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose, ...view };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
});

describe('TraceDetailPanel', () => {
  it('renders the header (eyebrow, algorithm display name, mono pair subtitle) and the close button', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('levenshtein'),
    );

    renderPanel();

    expect(
      await screen.findByRole('heading', { name: 'Levenshtein distance' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Traza')).toBeInTheDocument();
    expect(screen.getByText('doc-01 frente a doc-02')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar traza' })).toBeInTheDocument();
  });

  it('calls onClose when the close button is activated', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('jaccard'),
    );
    const user = userEvent.setup();
    const { onClose } = renderPanel({ algorithmId: 'jaccard' });

    await user.click(await screen.findByRole('button', { name: 'Cerrar traza' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('jaccard'),
    );
    const user = userEvent.setup();
    const { onClose } = renderPanel({ algorithmId: 'jaccard' });

    await screen.findByRole('heading', { name: 'Jaccard index' });
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the title once it renders', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('jaccard'),
    );

    renderPanel({ algorithmId: 'jaccard' });

    const title = await screen.findByRole('heading', { name: 'Jaccard index' });
    await waitFor(() => expect(title).toHaveFocus());
  });

  it('shows placeholder value bars in the meta row and a generic body skeleton while every fetch is pending', () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    renderPanel();

    // Every meta field renders with a placeholder value instead of being
    // silently omitted until its own fetch resolves — including the
    // DP-only optimal path, since `levenshtein` (the default algorithmId)
    // is already known to be a DP capability before the trace arrives.
    expect(screen.getByText('Familia')).toBeInTheDocument();
    // Once in the meta row and once as the result block's own tile label.
    expect(screen.getAllByText('Valor crudo')).toHaveLength(2);
    expect(screen.getByText('Puntaje')).toBeInTheDocument();
    expect(screen.getByText('Camino óptimo')).toBeInTheDocument();

    const status = screen.getByText('Cargando la traza…');
    expect(status).toHaveAttribute('role', 'status');
    expect(status.className).toContain('sr-only');
    expect(screen.getByTestId('trace-body-skeleton')).toBeInTheDocument();
  });

  it('never shows the DP-only optimal-path field for a non-DP trace, even while every fetch is pending', () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    renderPanel({ algorithmId: 'jaccard' });

    expect(screen.queryByText('Camino óptimo')).not.toBeInTheDocument();
  });

  it('shows the generic meta row (family, raw value, score) once both fetches resolve', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('jaccard'),
    );

    renderPanel({ algorithmId: 'jaccard' });

    expect(await screen.findByText('Clásico')).toBeInTheDocument();
    // The meta row's raw value, apart from the result block's large tile.
    expect(
      await screen.findByText('12', { selector: 'dd.font-mono.text-mono' }),
    ).toBeInTheDocument();
  });

  it("adds the DP-only optimal-path meta value for a DP trace, from the trace's own matrix, never recomputed", async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('levenshtein'),
    );

    renderPanel();

    expect(screen.getByText('Camino óptimo')).toBeInTheDocument();
    // DP_TRACE.matrix's bottom-right cell — the label shows immediately
    // (it is already known this algorithm is DP-only), but its own value
    // still waits for the trace fetch to resolve.
    expect(await screen.findByText('1', { selector: 'dd' })).toBeInTheDocument();
  });

  it('omits the optimal-path meta value for a non-DP trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('jaccard'),
    );

    renderPanel({ algorithmId: 'jaccard' });

    await screen.findByRole('heading', { name: 'Jaccard index' });
    expect(screen.queryByText('Camino óptimo')).not.toBeInTheDocument();
  });

  it('renders the routed capability body (DP matrix) without its own duplicate meta row or download button', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('levenshtein'),
    );

    renderPanel();

    expect((await screen.findAllByRole('cell')).length).toBeGreaterThan(0);
    // Only the panel's own footer CSV button, never DpMatrix's own inline one too.
    expect(screen.getAllByRole('button', { name: /csv/i })).toHaveLength(1);
    expect(screen.queryByTestId('dp-trace-family')).not.toBeInTheDocument();
  });

  describe('the scrollable body region', () => {
    it('never makes the body itself a focusable region for a DP trace — its own matrix region already is', async () => {
      vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);
      vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
        singleCompareResultFor('levenshtein'),
      );

      renderPanel();

      await screen.findAllByRole('cell');
      // The DP matrix's own region already carries `tabIndex={0}` — the
      // body wrapper around it must not add a second, redundant tab stop
      // for the same scrollable content.
      expect(
        screen.getByTestId('trace-detail-panel').querySelector('.overflow-y-auto'),
      ).not.toHaveAttribute('tabindex');
    });

    it('clips the body instead of scrolling it, with no tab stop, while the skeleton shows', () => {
      vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));
      vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockReturnValue(new Promise(() => {}));
      vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

      renderPanel({ algorithmId: 'jaccard' });

      const body = screen.getByTestId('trace-body-skeleton').parentElement!.parentElement!;
      expect(body).toHaveClass('overflow-y-hidden');
      expect(body).not.toHaveClass('overflow-y-auto');
      expect(body).not.toHaveAttribute('tabindex');
      expect(body).not.toHaveAttribute('role');
    });

    it('makes the body itself a focusable, labelled region for Jaccard — its own fields carry no control at all', async () => {
      vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
      vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
        singleCompareResultFor('jaccard'),
      );

      renderPanel({ algorithmId: 'jaccard' });

      const body = await screen.findByRole('region', { name: /jaccard/i });
      expect(body).toHaveAttribute('tabindex', '0');
      expect(body.className).toContain('overflow-y-auto');
    });
  });

  it('shows the result block above the trace, never in place of it', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('jaccard'),
    );

    renderPanel({ algorithmId: 'jaccard' });

    const block = await screen.findByRole('region', { name: 'Resultado' });
    const traceHeading = await screen.findByRole('heading', {
      name: new RegExp(`^${es.similarity.trace.jaccard.onlyALabel}`),
    });
    expect(block.compareDocumentPosition(traceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(within(block).getByText('0.750')).toBeInTheDocument();
  });

  it('shows the result block skeleton, hidden from assistive technology, while the results are pending', () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    renderPanel({ algorithmId: 'jaccard' });

    expect(screen.getByTestId('trace-result-block-skeleton')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('renders a "full screen" link to the standalone trace view, keeping the same pair', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('levenshtein'),
    );

    renderPanel();

    const link = await screen.findByRole('link', { name: 'Pantalla completa' });
    expect(link).toHaveAttribute(
      'href',
      '/similarity/levenshtein/trace/full?documentIdA=doc-01&documentIdB=doc-02',
    );
  });

  it('downloads the CSV from the footer button for a DP trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('levenshtein'),
    );
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const user = userEvent.setup();

    renderPanel();
    await screen.findAllByRole('cell');

    await user.click(screen.getByRole('button', { name: /csv/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('renders no CSV button for a non-DP trace', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('jaccard'),
    );

    renderPanel({ algorithmId: 'jaccard' });

    await screen.findByRole('heading', { name: 'Jaccard index' });
    expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument();
  });
});
