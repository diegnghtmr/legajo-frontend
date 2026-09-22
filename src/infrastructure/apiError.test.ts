import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';

import { mapAxiosErrorToApiError, NETWORK_ERROR_I18N_KEY } from './apiError';

function problemResponseError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixture, not a typed axios config
    config: {} as any,
    data,
  });
}

describe('mapAxiosErrorToApiError', () => {
  it('maps a 400 with the unknown-algorithm URN to its known i18n key', () => {
    const error = problemResponseError(400, {
      type: 'urn:legajo:problem:unknown-algorithm',
      title: 'Bad Request',
      status: 400,
      detail: 'no similarity algorithm registered with id: bogus',
    });

    const result = mapAxiosErrorToApiError(error);

    expect(result).toEqual({
      kind: 'problem',
      status: 400,
      type: 'urn:legajo:problem:unknown-algorithm',
      title: 'Bad Request',
      detail: 'no similarity algorithm registered with id: bogus',
      instance: undefined,
      i18nKey: 'errors.unknownAlgorithm',
    });
  });

  it('maps a 404 with the unknown-document URN to its known i18n key', () => {
    const error = problemResponseError(404, {
      type: 'urn:legajo:problem:unknown-document',
      title: 'Not Found',
      status: 404,
      detail: 'no corpus document with id: does-not-exist',
    });

    const result = mapAxiosErrorToApiError(error);

    expect(result.kind).toBe('problem');
    expect(result).toMatchObject({ i18nKey: 'errors.unknownDocument', status: 404 });
  });

  it('maps a 503 with the embedding-api-unavailable URN to its known i18n key', () => {
    const error = problemResponseError(503, {
      type: 'urn:legajo:problem:embedding-api-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail: 'The live embedding API is currently unavailable.',
    });

    const result = mapAxiosErrorToApiError(error);

    expect(result).toMatchObject({
      kind: 'problem',
      i18nKey: 'errors.embeddingApiUnavailable',
      status: 503,
    });
  });

  it('falls back by status (500) for an about:blank body with no fixed type', () => {
    const error = problemResponseError(500, {
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
    });

    const result = mapAxiosErrorToApiError(error);

    expect(result).toMatchObject({ kind: 'problem', status: 500, type: undefined });
    expect(result.kind === 'problem' && result.i18nKey).toBe('errors.serverError');
  });

  it('maps a timeout (ECONNABORTED, no response) to the cold-start network error', () => {
    const error = new AxiosError(
      'timeout of 60000ms exceeded',
      'ECONNABORTED',
      undefined,
      undefined,
      undefined,
    );

    const result = mapAxiosErrorToApiError(error);

    expect(result).toEqual({ kind: 'network', cause: 'timeout', i18nKey: NETWORK_ERROR_I18N_KEY });
  });

  it('maps a plain network error (no response, no timeout code) to the same cold-start message', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK', undefined, undefined, undefined);

    const result = mapAxiosErrorToApiError(error);

    expect(result).toEqual({
      kind: 'network',
      cause: 'no-response',
      i18nKey: NETWORK_ERROR_I18N_KEY,
    });
  });

  it('classifies a real about:blank 400 body as kind problem, keeping title/detail and falling back by status', () => {
    const error = problemResponseError(400, {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Malformed JSON request',
    });

    const result = mapAxiosErrorToApiError(error);

    expect(result).toEqual({
      kind: 'problem',
      status: 400,
      type: undefined,
      title: 'Bad Request',
      detail: 'Malformed JSON request',
      instance: undefined,
      i18nKey: 'errors.badRequest',
    });
  });

  it('classifies a real about:blank 500 body as kind problem, keeping title/detail and falling back by status', () => {
    const error = problemResponseError(500, {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
    });

    const result = mapAxiosErrorToApiError(error);

    expect(result).toEqual({
      kind: 'problem',
      status: 500,
      type: undefined,
      title: 'Internal Server Error',
      detail: 'An unexpected error occurred.',
      instance: undefined,
      i18nKey: 'errors.serverError',
    });
  });

  it('classifies an unknown (non-fixed) URN as kind problem, keeping title/detail and falling back by status', () => {
    const error = problemResponseError(400, {
      type: 'urn:legajo:problem:something-else',
      title: 'Bad Request',
      status: 400,
      detail: 'a future, not-yet-mapped problem type',
    });

    const result = mapAxiosErrorToApiError(error);

    expect(result).toEqual({
      kind: 'problem',
      status: 400,
      type: undefined,
      title: 'Bad Request',
      detail: 'a future, not-yet-mapped problem type',
      instance: undefined,
      i18nKey: 'errors.badRequest',
    });
  });

  it('maps a non-problem response body (unexpected shape) to an unexpected error, not a crash', () => {
    const error = problemResponseError(500, '<html>Internal Server Error</html>');

    const result = mapAxiosErrorToApiError(error);

    expect(result.kind).toBe('unexpected');
    expect(result).toMatchObject({ status: 500 });
  });

  it('maps a non-Axios error (e.g. a thrown plain Error) to an unexpected error', () => {
    const result = mapAxiosErrorToApiError(new Error('boom'));

    expect(result).toEqual({
      kind: 'unexpected',
      i18nKey: 'errors.unexpected',
      message: 'boom',
    });
  });
});
