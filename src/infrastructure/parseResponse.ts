import type { z } from 'zod';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiUnexpectedError } from './apiError';

/**
 * Validates a parsed JSON response against its Zod schema before the app
 * ever sees it. A failure here means the live backend disagrees with the
 * vendored OpenAPI contract (`contract/openapi-legajo.yaml`) — a real
 * integration bug, not a user-facing HTTP error. It throws rather than
 * silently passing through an unverified shape, but as the same `ApiError`
 * model every other error takes (`kind: 'unexpected'`, same shape
 * `handleResponseError` rejects with in `httpClient.ts`), so the UI and
 * `shouldRetryQuery` can handle it like any other error instead of an
 * unclassified raw `Error`.
 */
export function parseResponse<Schema extends z.ZodTypeAny>(
  schema: Schema,
  data: unknown,
  context: string,
): z.infer<Schema> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const apiError: ApiUnexpectedError = {
      kind: 'unexpected',
      i18nKey: DEFAULT_UNEXPECTED_I18N_KEY,
      message: `Invalid response shape for ${context}: ${result.error.message}`,
    };
    throw apiError;
  }

  return result.data;
}
