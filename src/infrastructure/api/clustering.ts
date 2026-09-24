import { z } from 'zod';

import type { operations } from '../../shared/types/api';
import { httpClient } from '../httpClient';
import { parseResponse } from '../parseResponse';
import { ClusterAssignmentSchema, LinkageResultSchema } from '../schemas/clustering';

export type ClusteringRequestBody = NonNullable<
  operations['runClustering']['requestBody']
>['content']['application/json'];
export type ClusteringResponse =
  operations['runClustering']['responses'][200]['content']['application/json'];

/**
 * `representation`/`linkages` omitted or null default to `tfidf-cosine` and
 * all four linkages. Evaluation is always computed at the fixed
 * cuts k ∈ {2,3,4,5} ∩ [2, n-1] — there is no `ks` parameter.
 */
export async function runClustering(body?: ClusteringRequestBody): Promise<ClusteringResponse> {
  const { data } = await httpClient.post<ClusteringResponse>('/api/v1/clustering', body ?? {});
  return parseResponse(z.array(LinkageResultSchema), data, 'POST /clustering');
}

export type ClusteringCutRequestBody =
  operations['cutClustering']['requestBody']['content']['application/json'];
export type ClusteringCutResponse =
  operations['cutClustering']['responses'][200]['content']['application/json'];

/** The only clustering endpoint accepting a free cut (integer k, no height cut). */
export async function cutClustering(
  body: ClusteringCutRequestBody,
): Promise<ClusteringCutResponse> {
  const { data } = await httpClient.post<ClusteringCutResponse>('/api/v1/clustering/cut', body);
  return parseResponse(ClusterAssignmentSchema, data, 'POST /clustering/cut');
}
