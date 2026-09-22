import { z } from 'zod';

import type { operations } from '../../shared/types/api';
import { httpClient } from '../httpClient';
import { parseResponse } from '../parseResponse';
import { CorpusDocumentSchema, CorpusSummarySchema } from '../schemas/corpus';

export type ListCorpusResponse =
  operations['listCorpus']['responses'][200]['content']['application/json'];

export async function fetchCorpus(): Promise<ListCorpusResponse> {
  const { data } = await httpClient.get<ListCorpusResponse>('/api/v1/corpus');
  return parseResponse(z.array(CorpusSummarySchema), data, 'GET /corpus');
}

export type GetCorpusDocumentResponse =
  operations['getCorpusDocument']['responses'][200]['content']['application/json'];

export async function fetchCorpusDocument(id: string): Promise<GetCorpusDocumentResponse> {
  const { data } = await httpClient.get<GetCorpusDocumentResponse>(
    `/api/v1/corpus/${encodeURIComponent(id)}`,
  );
  return parseResponse(CorpusDocumentSchema, data, 'GET /corpus/{id}');
}
