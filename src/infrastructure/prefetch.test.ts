import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as similarityApi from './api/similarity';
import { algorithmsQueryOptions } from './api/similarityCatalogue';
import { prefetchAppData } from './prefetch';

vi.mock('./api/similarity');

const CATALOGUE = [{ id: 'levenshtein', displayName: 'Levenshtein', kind: 'CLASSIC' }] as const;

beforeEach(() => {
  vi.mocked(similarityApi.fetchSimilarityAlgorithms).mockReset();
});

describe('prefetchAppData', () => {
  it('fills the algorithm catalogue cache under the key its consumers read', async () => {
    const fetchCatalogue = vi
      .spyOn(similarityApi, 'fetchSimilarityAlgorithms')
      .mockResolvedValue([...CATALOGUE]);
    const client = new QueryClient();

    await prefetchAppData(client);

    expect(client.getQueryData(algorithmsQueryOptions.queryKey)).toEqual(CATALOGUE);
    expect(fetchCatalogue).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when a consumer later asks for the cached catalogue', async () => {
    const fetchCatalogue = vi
      .spyOn(similarityApi, 'fetchSimilarityAlgorithms')
      .mockResolvedValue([...CATALOGUE]);
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });

    await prefetchAppData(client);
    await client.ensureQueryData(algorithmsQueryOptions);

    expect(fetchCatalogue).toHaveBeenCalledTimes(1);
  });

  it('resolves without throwing when the catalogue request fails', async () => {
    vi.spyOn(similarityApi, 'fetchSimilarityAlgorithms').mockRejectedValue(new Error('offline'));

    await expect(prefetchAppData(new QueryClient())).resolves.toBeUndefined();
  });
});
