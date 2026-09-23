import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '../httpClient';
import { fetchBenchmarks } from './benchmarks';

const VALID_PAYLOAD = {
  harness: {
    cpuModel: '12th Gen Intel(R) Core(TM) i9-12900H',
    logicalCores: 20,
    totalRamBytes: 33363460096,
    jdk: 'Eclipse Adoptium 25.0.4',
    os: 'Linux 7.2.5-3-omarchy (amd64)',
    measuredAt: '2026-09-23T00:43:04.800549029Z',
  },
  results: [
    {
      benchmark:
        'co.edu.uniquindio.legajo.benchmarks.pairwise.LevenshteinBenchmark.pairwiseCompute',
      family: 'levenshtein',
      parameter: 'length',
      size: 50,
      score: 7.893776651306136,
      error: 1.0946599763714326,
      unit: 'us/op',
    },
  ],
  slopes: [{ family: 'levenshtein', points: 5, empiricalSlope: 2.039288, theoreticalExponent: 2 }],
};

describe('fetchBenchmarks', () => {
  it('GETs the reference-run report', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: VALID_PAYLOAD });

    const result = await fetchBenchmarks();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/benchmarks');
    expect(result).toEqual(VALID_PAYLOAD);
  });

  it('throws when a result is missing a required field', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      data: { ...VALID_PAYLOAD, results: [{ ...VALID_PAYLOAD.results[0], unit: undefined }] },
    });

    await expect(fetchBenchmarks()).rejects.toThrow(/GET \/benchmarks\b/);
  });
});
