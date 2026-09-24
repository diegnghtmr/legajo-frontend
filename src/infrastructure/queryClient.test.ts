import { describe, expect, it } from 'vitest';

import type { ApiError } from './apiError';
import { queryClient } from './queryClient';
import { shouldRetryQuery } from './queryRetry';

describe('queryClient', () => {
  it('defaults staleTime to Infinity (the corpus and its derived results are static)', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(Infinity);
  });

  it('uses shouldRetryQuery itself as the retry policy, not an equivalent-looking function', () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });

  it('reproduces shouldRetryQuery behaviour: never retries a 4xx problem, retries a network error', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry as typeof shouldRetryQuery;

    const problem400: ApiError = {
      kind: 'problem',
      status: 400,
      type: 'urn:legajo:problem:unknown-algorithm',
      title: 'Bad Request',
      i18nKey: 'errors.unknownAlgorithm',
    };
    const network: ApiError = {
      kind: 'network',
      cause: 'timeout',
      i18nKey: 'errors.network.coldStart',
    };

    expect(retry(0, problem400)).toBe(false);
    expect(retry(0, network)).toBe(true);
  });
});
