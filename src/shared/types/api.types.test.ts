import { describe, expectTypeOf, it } from 'vitest';

import type { components } from './api';

type SimilarityResult = components['schemas']['SimilarityResult'];
type AlgorithmTrace = components['schemas']['AlgorithmTrace'];
type DpMatrixTrace = components['schemas']['DpMatrixTrace'];
type JaccardTrace = components['schemas']['JaccardTrace'];

/**
 * Contract-level test: fails to typecheck (not just to run) when
 * `npm run api:types` regenerates a shape that drops or renames a field the
 * rest of the app depends on. Keeps the OpenAPI -> TS generation honest
 * without duplicating Zod runtime validation (added in task W3).
 */
describe('generated OpenAPI contract types (src/shared/types/api.ts)', () => {
  it('SimilarityResult requires cached, degenerate and computedNanos', () => {
    expectTypeOf<SimilarityResult>().toHaveProperty('cached').toEqualTypeOf<boolean>();
    expectTypeOf<SimilarityResult>().toHaveProperty('degenerate').toEqualTypeOf<boolean>();
    expectTypeOf<SimilarityResult>().toHaveProperty('computedNanos').toEqualTypeOf<number>();
    expectTypeOf<SimilarityResult>().toHaveProperty('normalizedScore').toEqualTypeOf<number>();
  });

  it('AlgorithmTrace is the six-capability trace union, DP and Jaccard included', () => {
    expectTypeOf<DpMatrixTrace>().toMatchTypeOf<AlgorithmTrace>();
    expectTypeOf<JaccardTrace>().toMatchTypeOf<AlgorithmTrace>();
    expectTypeOf<AlgorithmTrace>().not.toEqualTypeOf<DpMatrixTrace>();
  });
});
