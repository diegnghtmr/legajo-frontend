import { describe, expect, it } from 'vitest';

import type { ApiError } from './apiError';
import { shouldRetryQuery } from './queryRetry';

const problem400: ApiError = {
  kind: 'problem',
  status: 400,
  type: 'urn:legajo:problem:unknown-algorithm',
  title: 'Bad Request',
  i18nKey: 'errors.unknownAlgorithm',
};

const problem503: ApiError = {
  kind: 'problem',
  status: 503,
  type: 'urn:legajo:problem:embedding-api-unavailable',
  title: 'Service Unavailable',
  i18nKey: 'errors.embeddingApiUnavailable',
};

const network: ApiError = {
  kind: 'network',
  cause: 'timeout',
  i18nKey: 'errors.network.coldStart',
};
const unexpected: ApiError = { kind: 'unexpected', i18nKey: 'errors.unexpected', message: 'boom' };

describe('shouldRetryQuery', () => {
  it('never retries a 4xx problem error', () => {
    expect(shouldRetryQuery(0, problem400)).toBe(false);
  });

  it('retries a 5xx problem error, up to the retry limit', () => {
    expect(shouldRetryQuery(0, problem503)).toBe(true);
    expect(shouldRetryQuery(1, problem503)).toBe(true);
  });

  it('stops retrying a 5xx problem error once the limit is reached', () => {
    expect(shouldRetryQuery(2, problem503)).toBe(false);
  });

  it('retries a network error, up to the retry limit', () => {
    expect(shouldRetryQuery(0, network)).toBe(true);
    expect(shouldRetryQuery(2, network)).toBe(false);
  });

  it('does not retry an unexpected error with no status', () => {
    expect(shouldRetryQuery(0, unexpected)).toBe(false);
  });

  it('does not retry an unexpected error with a status below 500 (e.g. a proxy 4xx)', () => {
    const unexpected4xx: ApiError = {
      kind: 'unexpected',
      status: 404,
      i18nKey: 'errors.unexpected',
      message: 'boom',
    };

    expect(shouldRetryQuery(0, unexpected4xx)).toBe(false);
  });

  it('retries an unexpected error with a 5xx status, up to the retry limit (e.g. a proxy HTML 502 while the free-tier backend wakes up)', () => {
    const unexpected502: ApiError = {
      kind: 'unexpected',
      status: 502,
      i18nKey: 'errors.unexpected',
      message: 'The server returned status 502 with an unrecognized response body.',
    };

    expect(shouldRetryQuery(0, unexpected502)).toBe(true);
    expect(shouldRetryQuery(1, unexpected502)).toBe(true);
    expect(shouldRetryQuery(2, unexpected502)).toBe(false);
  });

  it('does not retry a non-ApiError thrown value', () => {
    expect(shouldRetryQuery(0, new Error('plain error'))).toBe(false);
  });
});
