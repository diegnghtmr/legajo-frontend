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
    for (const row of rows) {
      expect(row.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    }
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
    expect(skeleton.querySelectorAll('li')).toHaveLength(2);
  });
});
