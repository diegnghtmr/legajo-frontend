import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, matchPath, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as similarityApi from '../../infrastructure/api/similarity';
import { stubNarrowViewport } from '../../test/matchMedia';
import { SimilarityCompareView } from './SimilarityCompareView';

vi.mock('../../infrastructure/api/similarity');

const CATALOGUE = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
  { id: 'embedding-local', displayName: 'Embedding (MiniLM local)', kind: 'AI' },
] as const;

function result(algorithmId: string, normalizedScore: number) {
  return {
    algorithmId,
    result: { normalizedScore, rawValue: 1, computedNanos: 10, cached: false, degenerate: false },
  };
}

function Harness() {
  const location = useLocation();
  const match = matchPath('/similarity/:algorithmId/trace', location.pathname);
  return (
    <>
      <SimilarityCompareView
        pair={['doc-01', 'doc-02']}
        openAlgorithmId={match?.params.algorithmId ?? null}
      />
      <p data-testid="location">{`${location.pathname}${location.search}`}</p>
    </>
  );
}

function renderView(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ALL_SELECTED = 'algorithms=levenshtein,jaccard,embedding-local';

let compare: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue([...CATALOGUE]);
  const rows = [result('levenshtein', 0.4), result('jaccard', 0.6), result('embedding-local', 0.8)];
  compare = vi
    .spyOn(similarityApi, 'compareSimilarity')
    .mockImplementation((async ({ algorithmIds }: { algorithmIds?: string[] }) =>
      rows.filter(({ algorithmId }) => (algorithmIds ?? []).includes(algorithmId))) as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SimilarityCompareView family filter', () => {
  it('shows only the selected algorithms of the family in the table and the strip, and asks once', async () => {
    const user = userEvent.setup();
    renderView(`/similarity?${ALL_SELECTED}`);

    await screen.findByRole('table');
    const table = () => screen.getByRole('table');
    expect(within(table()).getAllByRole('row')).toHaveLength(4);
    expect(compare).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('radio', { name: 'IA' }));

    await waitFor(() => expect(within(table()).getAllByRole('row')).toHaveLength(2));
    expect(within(table()).getByText('embedding-local')).toBeInTheDocument();
    expect(within(table()).queryByText('levenshtein')).not.toBeInTheDocument();
    expect(screen.getByTitle('embedding-local: 0.800')).toBeInTheDocument();
    expect(screen.queryByTitle('levenshtein: 0.400')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Todos' }));
    await waitFor(() => expect(within(table()).getAllByRole('row')).toHaveLength(4));
    // Hidden algorithms stay selected and compared: no new request either way.
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it('filters the narrow list too', async () => {
    stubNarrowViewport();
    const user = userEvent.setup();
    renderView(`/similarity?${ALL_SELECTED}`);

    const list = await screen.findByRole('list', { name: 'Resultados de similitud por algoritmo' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    const callsBefore = compare.mock.calls.length;

    await user.click(screen.getByRole('radio', { name: 'Clásico' }));

    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2));
    expect(within(list).queryByText('embedding-local')).not.toBeInTheDocument();
    expect(compare).toHaveBeenCalledTimes(callsBefore);
  });

  it('shows the empty state, naming the family, when none of its algorithms is selected', async () => {
    renderView('/similarity?algorithms=levenshtein,jaccard&family=ai');

    const empty = await screen.findByText('Ningún algoritmo IA seleccionado');
    expect(empty).toBeInTheDocument();
    expect(screen.getByText(/Todos/, { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('score-strip')).not.toBeInTheDocument();
  });

  it('closes the open trace when its algorithm is hidden and moves focus to the results heading', async () => {
    const user = userEvent.setup();
    renderView(
      `/similarity/levenshtein/trace?${ALL_SELECTED}&documentIdA=doc-01&documentIdB=doc-02`,
    );
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'IA' }));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toMatch(/^\/similarity\?/),
    );
    const location = screen.getByTestId('location').textContent ?? '';
    expect(location).toContain('family=ai');
    expect(location).not.toContain('documentIdA');
    expect(location).not.toContain('documentIdB');
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveFocus());
  });

  it('keeps the open trace when its algorithm stays visible', async () => {
    const user = userEvent.setup();
    renderView(
      `/similarity/embedding-local/trace?${ALL_SELECTED}&documentIdA=doc-01&documentIdB=doc-02`,
    );
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'IA' }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('family=ai'));
    expect(screen.getByTestId('location').textContent).toMatch(
      /^\/similarity\/embedding-local\/trace/,
    );
  });
});
