import type { operations } from '../../shared/types/api';
import { httpClient } from '../httpClient';
import { parseResponse } from '../parseResponse';
import { EmbeddingStatusSchema } from '../schemas/embeddings';

export type EmbeddingsStatusResponse =
  operations['embeddingsStatus']['responses'][200]['content']['application/json'];

/**
 * Both embedding families in one response: each reads its own cache and can
 * drift from the corpus independently.
 */
export async function fetchEmbeddingsStatus(): Promise<EmbeddingsStatusResponse> {
  const { data } = await httpClient.get<EmbeddingsStatusResponse>('/api/v1/embeddings/status');
  return parseResponse(EmbeddingStatusSchema, data, 'GET /embeddings/status');
}
