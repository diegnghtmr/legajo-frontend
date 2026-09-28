import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as similarityApi from '../../infrastructure/api/similarity';
import { algorithmsQueryOptions } from '../../infrastructure/api/similarityCatalogue';
import { stubNarrowViewport } from '../../test/matchMedia';
import { SimilarityCompareView } from './SimilarityCompareView';

vi.mock('../../infrastructure/api/similarity');

function renderView(initialEntry = '/similarity') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <SimilarityCompareView pair={['doc-01', 'doc-02']} openAlgorithmId={null} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SimilarityCompareView loading skeletons', () => {
  it('shows a hidden status and the six known mono ids, inert, before the algorithm catalogue resolves', () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));

    // An explicit, empty `algorithms` param — never the default (all six),
    // which would also enable the compare query and add its own `status`.
    renderView('/similarity?algorithms=');

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando el catálogo de algoritmos…');
    expect(status.className).toContain('sr-only');

    const skeleton = screen.getByTestId('algorithm-list-skeleton');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton.querySelectorAll('button, a, [tabindex]')).toHaveLength(0);
    // The ids are fixed capabilities, so the row renders them as real text
    // in the same box the selectable list will take.
    expect(skeleton).toHaveTextContent(
      'levenshteinneedleman-wunschjaccardtfidf-cosineembedding-localembedding-api',
    );
  });

  it('shows a table skeleton at lg+ with the real header row and one row per selected algorithm', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue([
      { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
      { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
    ]);
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    renderView('/similarity?algorithms=levenshtein,jaccard');

    await screen.findByRole('columnheader', { name: 'Algoritmo' });
    const status = screen.getByText('Calculando la comparación…');
    expect(status).toHaveAttribute('role', 'status');
    expect(status.className).toContain('sr-only');

    const rows = screen.getAllByTestId('compare-table-skeleton-row');
    expect(rows).toHaveLength(2);
    // The algorithm ids are already known from the URL's own selection
    // (never a guess), and this catalogue has already resolved — the
    // algorithm cell (a `<th scope="row">`, mirroring the real row) renders
    // the real mono id and the real display name as text, never a bar, so
    // it wraps exactly like the real cell does. The catalogue fetch's own
    // resolution is awaited explicitly (`findByText`), rather than assumed
    // from the table skeleton's own header already being on screen: that
    // header renders unconditionally on the very first render, before the
    // catalogue's mocked promise has necessarily settled.
    await screen.findByText('Levenshtein distance');
    const firstRowHeader = rows[0]!.querySelector('th')!;
    expect(firstRowHeader).toHaveTextContent('levenshtein');
    expect(firstRowHeader).toHaveTextContent('Levenshtein distance');
    expect(firstRowHeader.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
    const secondRowHeader = rows[1]!.querySelector('th')!;
    expect(secondRowHeader).toHaveTextContent('jaccard');
    expect(secondRowHeader).toHaveTextContent('Jaccard index');

    for (const row of rows) {
      // Every response-dependent cell still holds a placeholder; the family
      // cell (first) is real text, known from the id.
      const [, ...dataCells] = row.querySelectorAll('td');
      expect(dataCells).toHaveLength(4);
      for (const cell of dataCells) {
        expect(cell.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the id real and holds name and family as placeholders while the catalogue is still pending', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    // An explicit selection (never the "no algorithms" case above) so the
    // compare query is enabled while the catalogue is still pending.
    renderView('/similarity?algorithms=levenshtein,embedding-local');

    const rows = await screen.findAllByTestId('compare-table-skeleton-row');
    expect(rows).toHaveLength(2);
    const firstRowHeader = rows[0]!.querySelector('th')!;
    expect(firstRowHeader).toHaveTextContent('levenshtein');
    expect(firstRowHeader.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1);
    expect(rows[1]!.querySelector('th')).toHaveTextContent('embedding-local');
    // Nothing about the name or family is guessed client-side.
    expect(screen.queryByText('Embedding (MiniLM local)')).not.toBeInTheDocument();
    expect(
      rows[0]!.querySelectorAll('td')[0]!.querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(1);
  });

  it('renders the real names and families from a prefetched catalogue without asking the API again', () => {
    const fetchCatalogue = vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms');
    fetchCatalogue.mockClear();
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(algorithmsQueryOptions.queryKey, [
      { id: 'levenshtein', displayName: 'Levenshtein', kind: 'CLASSIC' },
      { id: 'embedding-local', displayName: 'Embedding (MiniLM local)', kind: 'AI' },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/similarity?algorithms=levenshtein,embedding-local']}>
          <SimilarityCompareView pair={['doc-01', 'doc-02']} openAlgorithmId={null} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Synchronously on the first render: no catalogue skeleton in between.
    expect(screen.queryByTestId('algorithm-list-skeleton')).not.toBeInTheDocument();
    const rows = screen.getAllByTestId('compare-table-skeleton-row');
    expect(rows[1]!.querySelector('th')).toHaveTextContent('Embedding (MiniLM local)');
    expect(rows[0]!.querySelectorAll('td')[0]).toHaveTextContent('Clásico');
    expect(rows[1]!.querySelectorAll('td')[0]).toHaveTextContent('IA');
    expect(fetchCatalogue).not.toHaveBeenCalled();
  });

  it('reserves the cached marker and the response-dependent values in the table skeleton', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    renderView('/similarity?algorithms=levenshtein');

    const [row] = await screen.findAllByTestId('compare-table-skeleton-row');
    const [, score, raw, time] = row!.querySelectorAll('td');
    // Score, raw value and time keep their own cell, each holding only a
    // placeholder; the time cell also holds the cached marker's box.
    for (const cell of [score, raw, time]) {
      expect(cell!.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    }
    expect(time!.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    expect(row).not.toHaveTextContent(/caché|cache/i);
  });

  it('shows a card list skeleton below lg with one card per selected algorithm', async () => {
    stubNarrowViewport();
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue([
      { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
      { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
    ]);
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    renderView('/similarity?algorithms=levenshtein,jaccard');

    const skeleton = await screen.findByTestId('compare-list-skeleton');
    const rows = skeleton.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    // The mono id is already known (the URL's own selection), so it
    // renders as real text — never a bar — and wraps exactly like the
    // real row's own id does at a narrow width.
    expect(rows[0]).toHaveTextContent('levenshtein');
    expect(rows[1]).toHaveTextContent('jaccard');
  });
});
