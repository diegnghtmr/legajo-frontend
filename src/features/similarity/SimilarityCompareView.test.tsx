import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as similarityApi from '../../infrastructure/api/similarity';
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
  it('shows a hidden status and six mono placeholder bars before the algorithm catalogue resolves', () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));

    // An explicit, empty `algorithms` param — never the default (all six),
    // which would also enable the compare query and add its own `status`.
    renderView('/similarity?algorithms=');

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando el catálogo de algoritmos…');
    expect(status.className).toContain('sr-only');

    const skeleton = screen.getByTestId('algorithm-list-skeleton');
    expect(skeleton.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6);
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
      // Every other (response-dependent) cell still holds a placeholder.
      const dataCells = row.querySelectorAll('td');
      expect(dataCells.length).toBeGreaterThan(0);
      for (const cell of dataCells) {
        expect(cell.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to a placeholder display-name bar in the table skeleton while the algorithm catalogue itself is still pending', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockReturnValue(new Promise(() => {}));
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    // An explicit selection (never the "no algorithms" case above) so the
    // compare query is enabled while the catalogue is still pending — the
    // one case where the real display name is not yet known.
    renderView('/similarity?algorithms=levenshtein,jaccard');

    const rows = await screen.findAllByTestId('compare-table-skeleton-row');
    const firstRowHeader = rows[0]!.querySelector('th')!;
    // The mono id is still real text — it never depends on the catalogue.
    expect(firstRowHeader).toHaveTextContent('levenshtein');
    expect(firstRowHeader.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1);
  });

  it('shows a card list skeleton below lg with one card per selected algorithm', async () => {
    stubNarrowViewport();
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue([
      { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
      { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
    ]);
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));

    renderView('/similarity?algorithms=levenshtein,jaccard');

    await screen.findByText('levenshtein');
    const skeleton = screen.getByTestId('compare-list-skeleton');
    const rows = skeleton.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    // The mono id is already known (the URL's own selection), so it
    // renders as real text — never a bar — and wraps exactly like the
    // real row's own id does at a narrow width.
    expect(rows[0]).toHaveTextContent('levenshtein');
    expect(rows[1]).toHaveTextContent('jaccard');
  });
});
