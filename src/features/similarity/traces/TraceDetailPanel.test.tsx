import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as similarityApi from '../../../infrastructure/api/similarity';
import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../../infrastructure/api/similarity';
import type { DpMatrixTrace, JaccardTrace } from '../../../infrastructure/schemas/similarity';
import { TraceDetailPanel } from './TraceDetailPanel';

vi.mock('../../../infrastructure/api/similarity');

const CATALOGUE: ListSimilarityAlgorithmsResponse = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
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

  it('shows the generic meta row (family, raw value, score) once both fetches resolve', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(JACCARD_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('jaccard'),
    );

    renderPanel({ algorithmId: 'jaccard' });

    expect(await screen.findByText('Clásico')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it("adds the DP-only optimal-path meta value for a DP trace, from the trace's own matrix, never recomputed", async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityTrace').mockResolvedValue(DP_TRACE);
    vi.spyOn(similarityApi, 'compareSimilarity').mockResolvedValue(
      singleCompareResultFor('levenshtein'),
    );

    renderPanel();

    expect(await screen.findByText('Camino óptimo')).toBeInTheDocument();
    // DP_TRACE.matrix's bottom-right cell.
    expect(screen.getByText('1', { selector: 'dd' })).toBeInTheDocument();
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
