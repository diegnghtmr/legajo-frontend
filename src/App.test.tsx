import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as benchmarksApi from './infrastructure/api/benchmarks';
import * as corpusApi from './infrastructure/api/corpus';
import { httpClient } from './infrastructure/httpClient';

vi.mock('./infrastructure/api/benchmarks');
vi.mock('./infrastructure/api/corpus');

import { App } from './App';

function renderAppAt(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(corpusApi, 'fetchCorpus').mockResolvedValue([]);
  // `corpusApi`/`benchmarksApi` are mocked whole (above), but every other
  // route's own data (similarity/clustering's algorithms catalogue
  // included) goes through this same shared client — stub it once here so
  // no route rendered by any test in this file can escape to a real
  // request; a pending, never-resolving promise leaves each query in its
  // own ordinary loading state instead of crashing on unmocked data.
  vi.spyOn(httpClient, 'get').mockReturnValue(new Promise(() => {}));
  vi.spyOn(httpClient, 'post').mockReturnValue(new Promise(() => {}));
});

describe('App', () => {
  it('renders the Legajo page shell with a level-one heading', () => {
    renderAppAt('/');

    expect(screen.getByRole('heading', { level: 1, name: /legajo/i })).toBeInTheDocument();
  });

  it('redirects the root path to the similarity workbench', async () => {
    renderAppAt('/');

    expect(
      await screen.findByRole('heading', { name: 'Comparación de similitud' }),
    ).toBeInTheDocument();
  });

  it('redirects /corpus and /corpus/:id into the similarity workbench too', async () => {
    renderAppAt('/corpus/doc-01');

    expect(
      await screen.findByRole('heading', { name: 'Comparación de similitud' }),
    ).toBeInTheDocument();
  });

  it('renders the similarity placeholder at /similarity', () => {
    renderAppAt('/similarity');

    expect(screen.getByRole('heading', { name: 'Comparación de similitud' })).toBeInTheDocument();
  });

  it('renders the matrix screen at /similarity/matrix', () => {
    renderAppAt('/similarity/matrix');

    expect(screen.getByRole('heading', { name: 'Matriz de similitud' })).toBeInTheDocument();
  });

  it('renders the trace placeholder at /similarity/:algorithmId/trace', () => {
    renderAppAt('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

    // The algorithm catalogue is not mocked here (this is a routing smoke
    // test, not a data test): the title falls back to the plain route id
    // until — or unless — that fetch resolves, never to a repeat of the
    // eyebrow.
    expect(screen.getByRole('heading', { name: 'levenshtein' })).toBeInTheDocument();
  });

  it('renders the clustering placeholder at /clustering', () => {
    renderAppAt('/clustering');

    expect(screen.getByRole('heading', { name: 'Agrupamiento jerárquico' })).toBeInTheDocument();
  });

  it('renders the benchmarks screen at /benchmarks without making a real request', () => {
    vi.spyOn(benchmarksApi, 'fetchBenchmarks').mockReturnValue(new Promise(() => {}));

    renderAppAt('/benchmarks');

    expect(
      screen.getByRole('heading', { name: 'Benchmarks de rendimiento (JMH)' }),
    ).toBeInTheDocument();
    expect(benchmarksApi.fetchBenchmarks).toHaveBeenCalledTimes(1);
  });

  it('renders the not-found page for an unknown route', () => {
    renderAppAt('/does-not-exist');

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });

  it('never lets a route that needs the algorithms catalogue reach the real network', async () => {
    renderAppAt('/similarity');

    await screen.findByRole('heading', { name: 'Comparación de similitud' });

    // Only `corpusApi`/`benchmarksApi` are mocked per-module above; every
    // other route's own fetch (the similarity/clustering algorithms
    // catalogue included) still goes through the *shared* `httpClient`, so
    // stubbing that one client below is what keeps every route hermetic,
    // not just the two explicitly mocked API modules.
    expect(httpClient.get).toHaveBeenCalledWith('/api/v1/similarity/algorithms');
  });
});
