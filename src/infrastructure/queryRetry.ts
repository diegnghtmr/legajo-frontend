import type { ApiError } from './apiError';

/** Caps retries for the errors that are actually worth retrying. */
const MAX_RETRIES = 2;

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    (error as { kind: unknown }).kind !== undefined
  );
}

/**
 * TanStack Query's `retry` option (TRD Appendix A, §6.7): a 4xx problem
 * response is a client mistake or a business-rule violation that retrying
 * cannot fix, so it never retries. A 5xx problem or a network/cold-start
 * failure can succeed on a later attempt, so it retries up to the limit. An
 * `unexpected` error with no known status is not retried, since its cause is
 * unknown; but one that does carry a 5xx status (e.g. a proxy's HTML 502
 * while the Render free-tier backend wakes up, TRD §14.4) is retried the
 * same as a 5xx problem, since the underlying cause is the same cold start.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) {
    return false;
  }

  if (!isApiError(error)) {
    return false;
  }

  if (error.kind === 'problem') {
    return error.status >= 500;
  }

  if (error.kind === 'unexpected') {
    return error.status !== undefined && error.status >= 500;
  }

  return error.kind === 'network';
}
