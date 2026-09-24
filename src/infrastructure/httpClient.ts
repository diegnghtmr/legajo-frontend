import axios from 'axios';

import { mapAxiosErrorToApiError, type ApiError } from './apiError';
import { loadEnv } from './env';

/**
 * Rejects with the mapped `ApiError` instead of the raw Axios error, so
 * every caller (TanStack Query included) sees the RFC 9457 error model
 * directly. Exported separately from the interceptor wiring below so it can
 * be unit-tested without triggering a real request.
 */
export function handleResponseError(error: unknown): Promise<never> {
  const apiError: ApiError = mapAxiosErrorToApiError(error);
  return Promise.reject(apiError);
}

/**
 * The app's single Axios instance. Base URL comes from the validated env
 * (`env.ts`): empty string in development, so requests stay relative and the
 * Vite `/api` proxy (`vite.config.ts`) routes them to `localhost:8080`.
 * 60s timeout absorbs a Render free-tier cold start.
 */
export const httpClient = axios.create({
  baseURL: loadEnv().apiBaseUrl,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.response.use((response) => response, handleResponseError);
