import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '../httpClient';
import { cutClustering, runClustering } from './clustering';

const evaluation = { cophenetic: 0.8, meanSilhouette: { '2': 0.5 }, daviesBouldin: { '2': null } };

describe('runClustering', () => {
  it('POSTs the request body and returns the parsed linkage results', async () => {
    const payload = [
      {
        linkageId: 'ward',
        linkageDisplayName: 'Ward',
        rows: [],
        leafOrder: [0, 1],
        documentIds: ['doc-01', 'doc-02'],
        evaluation,
      },
    ];
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({ data: payload });
    const body = { representation: 'tfidf-cosine' as const, linkages: ['ward' as const] };

    const result = await runClustering(body);

    expect(postSpy).toHaveBeenCalledWith('/api/v1/clustering', body);
    expect(result).toEqual(payload);
  });

  it('POSTs an empty body when none is given (server defaults apply)', async () => {
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({ data: [] });

    await runClustering();

    expect(postSpy).toHaveBeenCalledWith('/api/v1/clustering', {});
  });

  it('throws when an evaluation daviesBouldin value is neither a number nor null', async () => {
    vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
      data: [
        {
          linkageId: 'ward',
          linkageDisplayName: 'Ward',
          rows: [],
          leafOrder: [],
          evaluation: { ...evaluation, daviesBouldin: { '2': 'nope' } },
        },
      ],
    });

    await expect(runClustering()).rejects.toThrow(/POST \/clustering\b/);
  });
});

describe('cutClustering', () => {
  it('POSTs the cut request and returns the parsed assignment', async () => {
    const payload = { labels: [0, 0, 1], k: 2, documentIds: ['doc-01', 'doc-02', 'doc-03'] };
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({ data: payload });
    const body = { linkage: 'ward' as const, k: 2 };

    const result = await cutClustering(body);

    expect(postSpy).toHaveBeenCalledWith('/api/v1/clustering/cut', body);
    expect(result).toEqual(payload);
  });
});
