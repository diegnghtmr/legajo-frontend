import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiUnexpectedError } from './apiError';
import { parseResponse } from './parseResponse';

const schema = z.object({ id: z.string(), score: z.number().min(0).max(1) });

describe('parseResponse', () => {
  it('returns the parsed value when the data matches the schema', () => {
    const value = parseResponse(schema, { id: 'doc-01', score: 0.5 }, 'GET /example');

    expect(value).toEqual({ id: 'doc-01', score: 0.5 });
  });

  it('throws the same ApiError model as other errors (kind unexpected), naming the context, when the data does not match', () => {
    let thrown: unknown;

    try {
      parseResponse(schema, { id: 'doc-01', score: 1.2 }, 'GET /example');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    const apiError = thrown as ApiUnexpectedError;
    expect(apiError.kind).toBe('unexpected');
    expect(apiError.i18nKey).toBe(DEFAULT_UNEXPECTED_I18N_KEY);
    expect(apiError.message).toMatch(/GET \/example/);
    expect(thrown).not.toBeInstanceOf(Error);
  });
});
