import { QueryClient } from '@tanstack/react-query';

import { shouldRetryQuery } from './queryRetry';

/**
 * The corpus and every value derived from it (similarity, clustering,
 * embeddings status) are deterministic given the loaded corpus (TRD §6.6:
 * "Ausencia de estado"), so a fetched result never goes stale on its own —
 * `staleTime: Infinity` (TRD §6.7). Retries follow `queryRetry.ts`: never
 * on a 4xx problem, limited on network/5xx.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: shouldRetryQuery,
    },
  },
});
