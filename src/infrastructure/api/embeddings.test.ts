import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '../httpClient';
import { fetchEmbeddingsStatus } from './embeddings';

describe('fetchEmbeddingsStatus', () => {
  it('GETs both embedding families in one response', async () => {
    const payload = {
      embeddingLocal: {
        provider: 'sentence-transformers',
        model: 'all-MiniLM-L6-v2',
        dimension: 384,
        corpusSha256: 'abc',
        matchesCorpus: true,
        device: 'cpu',
      },
      embeddingApi: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimension: 1536,
        corpusSha256: 'abc',
        matchesCorpus: true,
        mode: 'cached',
      },
    };
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: payload });

    const result = await fetchEmbeddingsStatus();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/embeddings/status');
    expect(result).toEqual(payload);
  });

  it('throws when embeddingApi.mode is outside cached/live', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      data: {
        embeddingLocal: {
          provider: 'p',
          model: 'm',
          dimension: 1,
          corpusSha256: 'a',
          matchesCorpus: true,
          device: 'cpu',
        },
        embeddingApi: {
          provider: 'p',
          model: 'm',
          dimension: 1,
          corpusSha256: 'a',
          matchesCorpus: true,
          mode: 'stale',
        },
      },
    });

    await expect(fetchEmbeddingsStatus()).rejects.toThrow(/embeddings\/status/);
  });
});
