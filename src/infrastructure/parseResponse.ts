import type { z } from 'zod';

/**
 * Validates a parsed JSON response against its Zod schema before the app
 * ever sees it. A failure here means the live backend disagrees with the
 * vendored OpenAPI contract (`contract/openapi-legajo.yaml`) — a real
 * integration bug, not a user-facing HTTP error — so it throws rather than
 * silently passing through an unverified shape.
 */
export function parseResponse<Schema extends z.ZodTypeAny>(
  schema: Schema,
  data: unknown,
  context: string,
): z.infer<Schema> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid response shape for ${context}: ${result.error.message}`);
  }

  return result.data;
}
