import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as similarityApi from '../../../infrastructure/api/similarity';
import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../../infrastructure/api/similarity';
import { TraceResultBlock, TraceResultBlockSkeleton } from './TraceResultBlock';

vi.mock('../../../infrastructure/api/similarity');

const CATALOGUE: ListSimilarityAlgorithmsResponse = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
  { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' },
];

function row(
  algorithmId: string,
  overrides: Partial<CompareResponse[number]['result']> = {},
): CompareResponse[number] {
  return {
    algorithmId,
    result: {
      normalizedScore: 0.5,
      rawValue: 12,
      computedNanos: 1234567,
      cached: false,
      degenerate: false,
      ...overrides,
    },
  } as CompareResponse[number];
}

const ROWS: CompareResponse = [
  row('levenshtein', { normalizedScore: 0.9 }),
  row('jaccard', { normalizedScore: 0.75, rawValue: null, degenerate: true }),
  row('embedding-api', { normalizedScore: 0.3, rawValue: 0.1, cached: true }),
];

function mockCompare(rows: CompareResponse = ROWS) {
  vi.spyOn(similarityApi, 'compareSimilarity').mockImplementation(async ({ algorithmIds }) =>
    rows.filter(({ algorithmId }) => (algorithmIds ?? []).includes(algorithmId)),
  );
}

function renderBlock(algorithmId = 'jaccard', search = '') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/similarity${search}`]}>
        <TraceResultBlock algorithmId={algorithmId} documentIdA="doc-01" documentIdB="doc-02" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockResolvedValue(CATALOGUE);
});

describe('TraceResultBlock', () => {
  it('shows the four result tiles as a labelled region', async () => {
    mockCompare();
    renderBlock('levenshtein');

    const region = await screen.findByRole('region', { name: 'Resultado' });
    for (const label of ['Puntaje normalizado', 'Valor crudo', 'Tiempo (ns)', 'Degenerado']) {
      expect(within(region).getByText(label)).toBeInTheDocument();
    }
  });

  it('shows the normalized score large, with a family-coloured bar and its rank among the results', async () => {
    mockCompare();
    renderBlock('jaccard');

    const region = await screen.findByRole('region', { name: 'Resultado' });
    expect(within(region).getByText('0.750')).toBeInTheDocument();
    expect(await within(region).findByText('Nº 2 de 3')).toBeInTheDocument();
    const meter = within(region).getByRole('meter', { name: /jaccard/ });
    expect(meter).toHaveAttribute('aria-valuenow', '0.75');
    expect(meter.firstElementChild).toHaveClass('bg-classic');
  });

  it('colours the bar for an AI algorithm with the ai family', async () => {
    mockCompare();
    renderBlock('embedding-api');

    const meter = await screen.findByRole('meter', { name: /embedding-api/ });
    expect(meter.firstElementChild).toHaveClass('bg-ai');
  });

  it('ranks among the algorithms selected in the URL, not all of them', async () => {
    mockCompare();
    renderBlock('jaccard', '?algorithms=jaccard,embedding-api');

    expect(await screen.findByText('Nº 1 de 2')).toBeInTheDocument();
  });

  it('shows the raw value large, and a dash with its reason when the backend returns none', async () => {
    mockCompare();
    const { unmount } = renderBlock('levenshtein');
    const region = await screen.findByRole('region', { name: 'Resultado' });
    expect(within(region).getByText('12')).toBeInTheDocument();
    unmount();

    renderBlock('jaccard');
    const degenerateRegion = await screen.findByRole('region', { name: 'Resultado' });
    expect(within(degenerateRegion).getByText('—')).toBeInTheDocument();
    expect(within(degenerateRegion).getByText('No aplica en este caso degenerado')).toBeVisible();
  });

  it('shows the time in nanoseconds with the cached marker only for a cached result', async () => {
    mockCompare();
    const { unmount } = renderBlock('embedding-api');
    const region = await screen.findByRole('region', { name: 'Resultado' });
    expect(within(region).getByText('en caché')).toBeInTheDocument();
    unmount();

    renderBlock('levenshtein');
    const other = await screen.findByRole('region', { name: 'Resultado' });
    expect(within(other).queryByText('en caché')).not.toBeInTheDocument();
    expect(within(other).getByText(/1\.234\.567|1,234,567|1 234 567/)).toBeInTheDocument();
  });

  it('says Sí or No for the degenerate flag, as text', async () => {
    mockCompare();
    const { unmount } = renderBlock('jaccard');
    const region = await screen.findByRole('region', { name: 'Resultado' });
    expect(within(region).getByText('Sí')).toBeInTheDocument();
    unmount();

    renderBlock('levenshtein');
    expect(
      await within(await screen.findByRole('region', { name: 'Resultado' })).findByText('No'),
    ).toBeInTheDocument();
  });

  it('adds no request beyond the single result and the table selection', async () => {
    mockCompare();
    vi.mocked(similarityApi.compareSimilarity).mockClear();
    renderBlock('levenshtein');
    await screen.findByText('Nº 1 de 3');

    // The single-algorithm result and the selection's comparison, nothing else.
    expect(similarityApi.compareSimilarity).toHaveBeenCalledTimes(2);
  });

  it('lists every visible result against the others, best first, with the open row marked', async () => {
    mockCompare();
    renderBlock('jaccard');

    const heading = await screen.findByRole('heading', { name: 'Frente a los demás algoritmos' });
    const list = within(heading.closest('section')!).getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '1levenshtein0.900',
      '2jaccard0.750',
      '3embedding-api0.300',
    ]);
    expect(items[1]).toHaveAttribute('aria-current', 'true');
    expect(items[1]).toHaveClass('bg-paper-sunken');
    expect(items[0]).not.toHaveAttribute('aria-current');
    // Text, not controls.
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
  });

  it('draws each ranking bar in its family colour, dimmed except for the open row', async () => {
    mockCompare();
    renderBlock('jaccard');

    const heading = await screen.findByRole('heading', { name: 'Frente a los demás algoritmos' });
    const items = within(heading.closest('section')!).getAllByRole('listitem');
    const fill = (item: HTMLElement) => item.querySelector('[data-rank-fill]') as HTMLElement;
    expect(fill(items[0]!)).toHaveClass('bg-classic', 'opacity-55');
    expect(fill(items[1]!)).toHaveClass('bg-classic');
    expect(fill(items[1]!)).not.toHaveClass('opacity-55');
    expect(fill(items[2]!)).toHaveClass('bg-ai', 'opacity-55');
    expect(fill(items[0]!).style.width).toBe('90%');
    expect(fill(items[0]!).closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('gives tied scores the same rank', async () => {
    mockCompare([
      row('levenshtein', { normalizedScore: 0.5 }),
      row('jaccard', { normalizedScore: 0.5 }),
      row('embedding-api', { normalizedScore: 0.1 }),
    ]);
    renderBlock('jaccard');

    const heading = await screen.findByRole('heading', { name: 'Frente a los demás algoritmos' });
    const items = within(heading.closest('section')!).getAllByRole('listitem');
    expect(items.map((item) => item.textContent?.[0])).toEqual(['1', '1', '3']);
  });

  it('shows no ranking when there is only one result to compare', async () => {
    mockCompare();
    renderBlock('jaccard', '?algorithms=jaccard');

    await screen.findByRole('region', { name: 'Resultado' });
    expect(
      screen.queryByRole('heading', { name: 'Frente a los demás algoritmos' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the tiles and reserves the ranking rows while the selection is still loading', async () => {
    vi.spyOn(similarityApi, 'compareSimilarity').mockImplementation(async ({ algorithmIds }) => {
      if ((algorithmIds ?? []).length === 1) {
        return ROWS.filter(({ algorithmId }) => algorithmId === algorithmIds![0]);
      }
      return new Promise<CompareResponse>(() => {});
    });
    const { container } = renderBlock('jaccard');

    await screen.findByRole('region', { name: 'Resultado' });
    const placeholder = container.querySelector('[data-testid="trace-ranking-skeleton"]');
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    expect(placeholder?.querySelectorAll('li')).toHaveLength(6);
    expect(screen.getByText('Frente a los demás algoritmos')).toBeInTheDocument();
  });

  it('renders nothing when neither result can be fetched', async () => {
    vi.spyOn(similarityApi, 'compareSimilarity').mockRejectedValue({
      i18nKey: 'errors.unexpected',
    });
    const { container } = renderBlock('levenshtein');

    await vi.waitFor(() => expect(similarityApi.compareSimilarity).toHaveBeenCalled());
    await vi.waitFor(() => expect(container.querySelector('[aria-hidden="true"]')).toBeNull());
    expect(screen.queryByRole('region', { name: 'Resultado' })).not.toBeInTheDocument();
  });

  it('shows an inert skeleton of the same tiles while the results are pending', () => {
    vi.spyOn(similarityApi, 'compareSimilarity').mockReturnValue(new Promise(() => {}));
    const { container } = renderBlock('levenshtein');

    const skeleton = container.querySelector('[data-testid="trace-result-block-skeleton"]');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton?.querySelectorAll('button, a, [tabindex]')).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Resultado' })).not.toBeInTheDocument();
  });
});

describe('TraceResultBlockSkeleton', () => {
  it('reserves one ranking row per algorithm being compared', () => {
    const { container } = render(<TraceResultBlockSkeleton rowCount={4} />);
    expect(container.querySelectorAll('[data-testid="trace-ranking-skeleton"] li')).toHaveLength(4);
  });

  it('keeps the four real labels and holds only the values as placeholders', () => {
    const { container } = render(<TraceResultBlockSkeleton />);

    for (const label of ['Puntaje normalizado', 'Valor crudo', 'Tiempo (ns)', 'Degenerado']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(3);
  });
});
