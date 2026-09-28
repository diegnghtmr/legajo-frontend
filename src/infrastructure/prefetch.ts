import type { QueryClient } from '@tanstack/react-query';

import { algorithmsQueryOptions } from './api/similarityCatalogue';

/**
 * Starts the requests every session needs as early as possible, before the
 * first screen mounts. Failures are swallowed on purpose: a screen that reads
 * an entry which did not load fetches it again on its own and shows its own
 * error state.
 */
export function prefetchAppData(client: QueryClient): Promise<void> {
  return client.prefetchQuery(algorithmsQueryOptions);
}
