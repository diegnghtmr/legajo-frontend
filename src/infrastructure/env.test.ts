import { describe, expect, it } from 'vitest';

import { EnvValidationError, loadEnv, resolveEnv } from './env';

describe('resolveEnv', () => {
  it('accepts a valid absolute URL in any mode', () => {
    expect(
      resolveEnv({ VITE_API_BASE_URL: 'https://legajo-api.onrender.com', PROD: true }),
    ).toEqual({ apiBaseUrl: 'https://legajo-api.onrender.com' });
  });

  it('falls back to same-origin ("") in development when the value is missing', () => {
    expect(resolveEnv({ VITE_API_BASE_URL: undefined, PROD: false })).toEqual({ apiBaseUrl: '' });
  });

  it('falls back to same-origin ("") in development when the value is an empty string', () => {
    expect(resolveEnv({ VITE_API_BASE_URL: '', PROD: false })).toEqual({ apiBaseUrl: '' });
  });

  it('throws in production when the value is missing', () => {
    expect(() => resolveEnv({ VITE_API_BASE_URL: undefined, PROD: true })).toThrow(
      EnvValidationError,
    );
  });

  it('throws in production when the value is an empty string', () => {
    expect(() => resolveEnv({ VITE_API_BASE_URL: '', PROD: true })).toThrow(EnvValidationError);
  });

  it('throws when the value is present but not a valid absolute URL, in any mode', () => {
    expect(() => resolveEnv({ VITE_API_BASE_URL: 'not-a-url', PROD: false })).toThrow(
      EnvValidationError,
    );
    expect(() => resolveEnv({ VITE_API_BASE_URL: 'not-a-url', PROD: true })).toThrow(
      EnvValidationError,
    );
  });

  it('also treats MODE === "production" as production when PROD is not explicitly set', () => {
    expect(() => resolveEnv({ VITE_API_BASE_URL: undefined, MODE: 'production' })).toThrow(
      EnvValidationError,
    );
  });
});

describe('loadEnv', () => {
  it('resolves from the real import.meta.env without throwing under the Vitest test mode', () => {
    // Vitest runs with `import.meta.env.PROD === false`, so a missing
    // `VITE_API_BASE_URL` (never set in this repo's test environment) must
    // fall back to same-origin, not throw.
    expect(loadEnv()).toEqual({ apiBaseUrl: '' });
  });
});
