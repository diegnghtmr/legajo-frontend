import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import type { components } from '../../shared/types/api';
import { ProblemDetailSchema, ProblemTypeSchema } from './problemDetail';

type ProblemDetail = components['schemas']['ProblemDetail'];

describe('ProblemDetailSchema (contract)', () => {
  it('infers a type mutually assignable with the generated ProblemDetail', () => {
    expectTypeOf<z.infer<typeof ProblemDetailSchema>>().toEqualTypeOf<ProblemDetail>();
  });
});

describe('ProblemDetailSchema (runtime)', () => {
  it('accepts a real fixed-URN problem body', () => {
    const result = ProblemDetailSchema.safeParse({
      type: 'urn:legajo:problem:unknown-algorithm',
      title: 'Bad Request',
      status: 400,
      detail: 'no similarity algorithm registered with id: bogus',
      instance: '/api/v1/similarity/compare',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a framework-detected body with no type (about:blank case)', () => {
    const result = ProblemDetailSchema.safeParse({
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a type outside the seven fixed URNs', () => {
    const result = ProblemDetailSchema.safeParse({
      type: 'urn:legajo:problem:something-else',
      title: 'Bad Request',
      status: 400,
    });

    expect(result.success).toBe(false);
  });

  it('rejects a body missing the required title or status', () => {
    expect(ProblemDetailSchema.safeParse({ status: 400 }).success).toBe(false);
    expect(ProblemDetailSchema.safeParse({ title: 'Bad Request' }).success).toBe(false);
  });

  it('exposes the seven fixed URNs on ProblemTypeSchema', () => {
    expect(ProblemTypeSchema.options).toEqual([
      'urn:legajo:problem:unknown-document',
      'urn:legajo:problem:unknown-algorithm',
      'urn:legajo:problem:unknown-representation',
      'urn:legajo:problem:unknown-linkage',
      'urn:legajo:problem:invalid-cut',
      'urn:legajo:problem:invalid-selection',
      'urn:legajo:problem:embedding-api-unavailable',
    ]);
  });
});
