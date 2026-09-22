import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '../httpClient';
import { fetchCorpus, fetchCorpusDocument } from './corpus';

describe('fetchCorpus', () => {
  it('GETs /api/v1/corpus and returns the parsed list', async () => {
    const payload = [{ id: 'doc-01', title: 'Title A', authors: ['A. Author'] }];
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: payload });

    const result = await fetchCorpus();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/corpus');
    expect(result).toEqual(payload);
  });

  it('throws when the response does not match CorpusSummary[]', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: [{ id: 'doc-01' }] });

    await expect(fetchCorpus()).rejects.toThrow(/GET \/corpus/);
  });
});

describe('fetchCorpusDocument', () => {
  it('GETs /api/v1/corpus/{id} and returns the parsed document', async () => {
    const payload = {
      id: 'doc-01',
      title: 'Title A',
      authors: ['A. Author'],
      abstract: 'An abstract.',
    };
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: payload });

    const result = await fetchCorpusDocument('doc-01');

    expect(getSpy).toHaveBeenCalledWith('/api/v1/corpus/doc-01');
    expect(result).toEqual(payload);
  });

  it('URL-encodes the document id', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      data: { id: 'doc/01', title: 'T', authors: [], abstract: 'A' },
    });

    await fetchCorpusDocument('doc/01');

    expect(getSpy).toHaveBeenCalledWith('/api/v1/corpus/doc%2F01');
  });
});
