import { z } from 'zod';

import type { operations } from '../../shared/types/api';
import { httpClient } from '../httpClient';
import { parseResponse } from '../parseResponse';
import {
  AlgorithmSimilaritySchema,
  AlgorithmSummarySchema,
  AlgorithmTraceSchema,
  SimilarityResultSchema,
} from '../schemas/similarity';

export type CompareRequestBody =
  operations['compareSimilarity']['requestBody']['content']['application/json'];
export type CompareResponse =
  operations['compareSimilarity']['responses'][200]['content']['application/json'];

/** `algorithmIds` omitted or null defaults to all six capabilities (TAC-01, HU-1.1). */
export async function compareSimilarity(body: CompareRequestBody): Promise<CompareResponse> {
  const { data } = await httpClient.post<CompareResponse>('/api/v1/similarity/compare', body);
  return parseResponse(z.array(AlgorithmSimilaritySchema), data, 'POST /similarity/compare');
}

export type MatrixRequestBody =
  operations['similarityMatrix']['requestBody']['content']['application/json'];
export type MatrixResponse =
  operations['similarityMatrix']['responses'][200]['content']['application/json'];

/** m x m grid; business rule m ∈ [3, n] is enforced server-side (400 invalid-selection). */
export async function fetchSimilarityMatrix(body: MatrixRequestBody): Promise<MatrixResponse> {
  const { data } = await httpClient.post<MatrixResponse>('/api/v1/similarity/matrix', body);
  return parseResponse(z.array(z.array(SimilarityResultSchema)), data, 'POST /similarity/matrix');
}

export type SimilarityTraceParams = operations['similarityTrace']['parameters']['path'] &
  operations['similarityTrace']['parameters']['query'];
export type SimilarityTraceResponse =
  operations['similarityTrace']['responses'][200]['content']['application/json'];

/** Always the complete trace: NFR-QA-03 forbids a truncation parameter. */
export async function fetchSimilarityTrace(
  params: SimilarityTraceParams,
): Promise<SimilarityTraceResponse> {
  const { algorithmId, documentIdA, documentIdB } = params;
  const { data } = await httpClient.get<SimilarityTraceResponse>(
    `/api/v1/similarity/${encodeURIComponent(algorithmId)}/trace`,
    { params: { documentIdA, documentIdB } },
  );
  return parseResponse(AlgorithmTraceSchema, data, 'GET /similarity/{algorithmId}/trace');
}

export type ListSimilarityAlgorithmsResponse =
  operations['listSimilarityAlgorithms']['responses'][200]['content']['application/json'];

export async function fetchSimilarityAlgorithms(): Promise<ListSimilarityAlgorithmsResponse> {
  const { data } = await httpClient.get<ListSimilarityAlgorithmsResponse>(
    '/api/v1/similarity/algorithms',
  );
  return parseResponse(z.array(AlgorithmSummarySchema), data, 'GET /similarity/algorithms');
}
