import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseResponse } from './parseResponse';

const schema = z.object({ id: z.string(), score: z.number().min(0).max(1) });

describe('parseResponse', () => {
  it('returns the parsed value when the data matches the schema', () => {
    const value = parseResponse(schema, { id: 'doc-01', score: 0.5 }, 'GET /example');

    expect(value).toEqual({ id: 'doc-01', score: 0.5 });
  });

  it('throws a descriptive error, naming the context, when the data does not match', () => {
    expect(() => parseResponse(schema, { id: 'doc-01', score: 1.2 }, 'GET /example')).toThrow(
      /GET \/example/,
    );
  });
});
