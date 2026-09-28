import { queryOptions } from '@tanstack/react-query';

import type { ApiError } from '../apiError';
import { fetchSimilarityAlgorithms, type ListSimilarityAlgorithmsResponse } from './similarity';

/**
 * The one definition of the algorithm catalogue query. The startup prefetch
 * and every screen that reads the catalogue share this key and fetcher, so a
 * prefetched entry is exactly the entry the screens find in the cache.
 */
export const algorithmsQueryOptions = queryOptions<ListSimilarityAlgorithmsResponse, ApiError>({
  queryKey: ['similarity', 'algorithms'],
  queryFn: () => fetchSimilarityAlgorithms(),
});
