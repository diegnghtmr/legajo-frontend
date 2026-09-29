import { queryOptions } from '@tanstack/react-query';

import type { ApiError } from '../../infrastructure/apiError';
import {
  compareSimilarity,
  type CompareRequestBody,
  type CompareResponse,
} from '../../infrastructure/api/similarity';
import type { AlgorithmId } from '../../infrastructure/schemas/similarity';

/**
 * The pairwise compare query, defined once so the results table and the
 * trace panel's result block read the same cache entry: the block adds no
 * request when the table for the same selection is already on screen.
 */
export function compareQueryOptions(
  documentIdA: string,
  documentIdB: string,
  algorithmIds: readonly AlgorithmId[],
) {
  return queryOptions<CompareResponse, ApiError>({
    queryKey: ['similarity', 'compare', documentIdA, documentIdB, algorithmIds] as const,
    queryFn: () => {
      const body: CompareRequestBody = {
        documentIdA,
        documentIdB,
        algorithmIds: [...algorithmIds],
      };
      return compareSimilarity(body);
    },
  });
}

/** One algorithm for one pair, independent of the table's selection: the trace
 * panel's meta row and result block stay correct on a bookmarked deep link. */
export function singleCompareQueryOptions(
  documentIdA: string,
  documentIdB: string,
  algorithmId: string,
) {
  return queryOptions<CompareResponse, ApiError>({
    queryKey: ['similarity', 'compareSingle', documentIdA, documentIdB, algorithmId] as const,
    queryFn: () =>
      compareSimilarity({
        documentIdA,
        documentIdB,
        algorithmIds: [algorithmId as AlgorithmId],
      }),
  });
}
