import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';

import { handleResponseError, httpClient } from './httpClient';
import { NETWORK_ERROR_I18N_KEY } from './apiError';

describe('httpClient', () => {
  it('sets a 60s timeout (Render free-tier cold start)', () => {
    expect(httpClient.defaults.timeout).toBe(60_000);
  });

  it('sends JSON by default', () => {
    expect(httpClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('resolves its base URL from the validated env (same-origin "" under Vitest test mode)', () => {
    expect(httpClient.defaults.baseURL).toBe('');
  });
});

describe('handleResponseError', () => {
  it('rejects with the mapped ApiError, not the raw AxiosError', async () => {
    const error = new AxiosError(
      'timeout of 60000ms exceeded',
      'ECONNABORTED',
      undefined,
      undefined,
      undefined,
    );

    await expect(handleResponseError(error)).rejects.toEqual({
      kind: 'network',
      cause: 'timeout',
      i18nKey: NETWORK_ERROR_I18N_KEY,
    });
  });
});
