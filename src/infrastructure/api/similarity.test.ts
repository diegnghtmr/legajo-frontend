import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '../httpClient';
import {
  compareSimilarity,
  fetchSimilarityAlgorithms,
  fetchSimilarityMatrix,
  fetchSimilarityTrace,
} from './similarity';

const similarityResult = {
  normalizedScore: 0.5,
  rawValue: 1,
  computedNanos: 100,
  cached: false,
  degenerate: false,
  stemming: false,
};

describe('compareSimilarity', () => {
  it('POSTs the request body and returns the parsed results', async () => {
    const payload = [{ algorithmId: 'jaccard', result: similarityResult }];
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({ data: payload });
    const body = { documentIdA: 'doc-01', documentIdB: 'doc-02' };

    const result = await compareSimilarity(body);

    expect(postSpy).toHaveBeenCalledWith('/api/v1/similarity/compare', body);
    expect(result).toEqual(payload);
  });

  it('throws when a result score is outside [0,1]', async () => {
    vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
      data: [{ algorithmId: 'jaccard', result: { ...similarityResult, normalizedScore: 1.5 } }],
    });

    await expect(
      compareSimilarity({ documentIdA: 'doc-01', documentIdB: 'doc-02' }),
    ).rejects.toThrow(/similarity\/compare/);
  });
});

describe('fetchSimilarityMatrix', () => {
  it('POSTs the request body and returns the parsed m x m grid', async () => {
    const payload = [[similarityResult]];
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({ data: payload });
    const body = { algorithmId: 'jaccard' as const, documentIds: ['doc-01', 'doc-02', 'doc-03'] };

    const result = await fetchSimilarityMatrix(body);

    expect(postSpy).toHaveBeenCalledWith('/api/v1/similarity/matrix', body);
    expect(result).toEqual(payload);
  });
});

describe('fetchSimilarityTrace', () => {
  it('GETs the trace with algorithmId in the path and document ids as query params', async () => {
    const payload = {
      algorithmId: 'jaccard',
      stemming: false,
      setA: ['a'],
      setB: ['b'],
      intersectionSize: 0,
      unionSize: 2,
      intersection: [],
      union: ['a', 'b'],
      coefficient: 0,
    };
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: payload });

    const result = await fetchSimilarityTrace({
      algorithmId: 'jaccard',
      documentIdA: 'doc-01',
      documentIdB: 'doc-02',
    });

    expect(getSpy).toHaveBeenCalledWith('/api/v1/similarity/jaccard/trace', {
      params: { documentIdA: 'doc-01', documentIdB: 'doc-02' },
    });
    expect(result).toEqual(payload);
  });

  it('throws on a wrong-discriminator trace payload', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      data: { algorithmId: 'jaccard', matrix: [[0]] },
    });

    await expect(
      fetchSimilarityTrace({ algorithmId: 'jaccard', documentIdA: 'a', documentIdB: 'b' }),
    ).rejects.toThrow(/similarity\/\{algorithmId\}\/trace/);
  });
});

describe('fetchSimilarityAlgorithms', () => {
  it('GETs the catalogue and returns it parsed', async () => {
    const payload = [{ id: 'jaccard', displayName: 'Jaccard', kind: 'CLASSIC' }];
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: payload });

    const result = await fetchSimilarityAlgorithms();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/similarity/algorithms');
    expect(result).toEqual(payload);
  });
});
