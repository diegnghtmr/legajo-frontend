import { z } from 'zod';

const apiBaseUrlSchema = z.url();

/**
 * The subset of Vite's `ImportMetaEnv` this module reads. Kept as a plain
 * interface (rather than reading `import.meta.env` directly inside
 * `resolveEnv`) so the validation logic is a pure function the tests can
 * drive with arbitrary inputs, without stubbing Vite's env object.
 */
export interface RawEnv {
  VITE_API_BASE_URL?: string;
  MODE?: string;
  PROD?: boolean;
}

export interface AppEnv {
  /**
   * Empty string means same-origin: the dev-only Vite proxy (`vite.config.ts`,
   * `/api` -> `http://localhost:8080`) handles routing, so the HTTP client
   * must send relative request paths rather than an absolute base URL.
   */
  apiBaseUrl: string;
}

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

function isProductionMode(raw: RawEnv): boolean {
  return raw.PROD === true || raw.MODE === 'production';
}

/**
 * Validates `VITE_API_BASE_URL` (TRD Appendix A, §14.4). In development an
 * absent or empty value is not an error: it falls back to same-origin so the
 * Vite `/api` proxy works. In a production build a missing value is a
 * configuration mistake (the deployed bundle would have no backend to call,
 * TAC-11) and must fail loudly instead of silently calling same-origin.
 */
export function resolveEnv(raw: RawEnv): AppEnv {
  const rawValue = raw.VITE_API_BASE_URL;

  if (rawValue === undefined || rawValue === '') {
    if (isProductionMode(raw)) {
      throw new EnvValidationError(
        'VITE_API_BASE_URL must be set for a production build (TRD §14.4): set it in the ' +
          'Vercel build environment to the deployed Render API URL.',
      );
    }

    return { apiBaseUrl: '' };
  }

  const result = apiBaseUrlSchema.safeParse(rawValue);
  if (!result.success) {
    throw new EnvValidationError(
      `VITE_API_BASE_URL must be a valid absolute URL, got: ${JSON.stringify(rawValue)}`,
    );
  }

  return { apiBaseUrl: result.data };
}

export function loadEnv(): AppEnv {
  return resolveEnv({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
  });
}
