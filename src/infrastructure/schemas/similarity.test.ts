import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import type { components } from '../../shared/types/api';
import {
  AlgorithmIdSchema,
  AlgorithmSimilaritySchema,
  AlgorithmSummarySchema,
  AlgorithmTraceSchema,
  DpMatrixTraceSchema,
  EmbeddingApiTraceSchema,
  EmbeddingLocalTraceSchema,
  JaccardTraceSchema,
  SimilarityResultSchema,
  TfIdfCosineTraceSchema,
} from './similarity';

type SimilarityResult = components['schemas']['SimilarityResult'];
type AlgorithmSimilarity = components['schemas']['AlgorithmSimilarity'];
type AlgorithmSummary = components['schemas']['AlgorithmSummary'];
type AlgorithmTrace = components['schemas']['AlgorithmTrace'];
type DpMatrixTrace = components['schemas']['DpMatrixTrace'];
type JaccardTrace = components['schemas']['JaccardTrace'];
type TfIdfCosineTrace = components['schemas']['TfIdfCosineTrace'];
type EmbeddingLocalTrace = components['schemas']['EmbeddingLocalTrace'];
type EmbeddingApiTrace = components['schemas']['EmbeddingApiTrace'];

describe('similarity schemas (contract)', () => {
  it('SimilarityResultSchema is mutually assignable with the generated SimilarityResult', () => {
    expectTypeOf<z.infer<typeof SimilarityResultSchema>>().toEqualTypeOf<SimilarityResult>();
  });

  it('AlgorithmSimilaritySchema matches AlgorithmSimilarity', () => {
    expectTypeOf<z.infer<typeof AlgorithmSimilaritySchema>>().toEqualTypeOf<AlgorithmSimilarity>();
  });

  it('AlgorithmSummarySchema matches AlgorithmSummary', () => {
    expectTypeOf<z.infer<typeof AlgorithmSummarySchema>>().toEqualTypeOf<AlgorithmSummary>();
  });

  it('DpMatrixTraceSchema matches DpMatrixTrace', () => {
    expectTypeOf<z.infer<typeof DpMatrixTraceSchema>>().toEqualTypeOf<DpMatrixTrace>();
  });

  it('JaccardTraceSchema matches JaccardTrace', () => {
    expectTypeOf<z.infer<typeof JaccardTraceSchema>>().toEqualTypeOf<JaccardTrace>();
  });

  it('TfIdfCosineTraceSchema matches TfIdfCosineTrace', () => {
    expectTypeOf<z.infer<typeof TfIdfCosineTraceSchema>>().toEqualTypeOf<TfIdfCosineTrace>();
  });

  it('EmbeddingLocalTraceSchema matches EmbeddingLocalTrace', () => {
    expectTypeOf<z.infer<typeof EmbeddingLocalTraceSchema>>().toEqualTypeOf<EmbeddingLocalTrace>();
  });

  it('EmbeddingApiTraceSchema matches EmbeddingApiTrace', () => {
    expectTypeOf<z.infer<typeof EmbeddingApiTraceSchema>>().toEqualTypeOf<EmbeddingApiTrace>();
  });

  it('AlgorithmTraceSchema (the trace union) matches AlgorithmTrace', () => {
    expectTypeOf<z.infer<typeof AlgorithmTraceSchema>>().toEqualTypeOf<AlgorithmTrace>();
  });
});

describe('AlgorithmIdSchema', () => {
  it('accepts exactly the six fixed capability ids', () => {
    expect(AlgorithmIdSchema.options).toEqual([
      'levenshtein',
      'needleman-wunsch',
      'jaccard',
      'tfidf-cosine',
      'embedding-local',
      'embedding-api',
    ]);
  });
});

describe('SimilarityResultSchema (runtime)', () => {
  const validPayload = {
    normalizedScore: 0.842,
    rawValue: 12,
    computedNanos: 45210,
    cached: true,
    degenerate: false,
  };

  it('accepts a real-shaped result with a numeric rawValue', () => {
    expect(SimilarityResultSchema.safeParse(validPayload).success).toBe(true);
  });

  it('accepts a null rawValue (the documented degenerate case)', () => {
    expect(
      SimilarityResultSchema.safeParse({ ...validPayload, rawValue: null, degenerate: true })
        .success,
    ).toBe(true);
  });

  it('accepts an omitted rawValue', () => {
    const { rawValue: _rawValue, ...withoutRawValue } = validPayload;
    expect(SimilarityResultSchema.safeParse(withoutRawValue).success).toBe(true);
  });

  it('rejects a score above 1 (out of the [0,1] range)', () => {
    expect(
      SimilarityResultSchema.safeParse({ ...validPayload, normalizedScore: 1.2 }).success,
    ).toBe(false);
  });

  it('rejects a score below 0', () => {
    expect(
      SimilarityResultSchema.safeParse({ ...validPayload, normalizedScore: -0.1 }).success,
    ).toBe(false);
  });

  it('rejects a payload missing the required degenerate flag', () => {
    const { degenerate: _degenerate, ...withoutDegenerate } = validPayload;
    expect(SimilarityResultSchema.safeParse(withoutDegenerate).success).toBe(false);
  });

  it('rejects a payload missing the required cached flag', () => {
    const { cached: _cached, ...withoutCached } = validPayload;
    expect(SimilarityResultSchema.safeParse(withoutCached).success).toBe(false);
  });
});

const matrixCell = { row: 0, col: 0 };

describe('DpMatrixTraceSchema (runtime)', () => {
  const dpPayload = {
    algorithmId: 'needleman-wunsch',
    rowLabels: ['A', 'B'],
    columnLabels: ['A', 'C'],
    matrix: [
      [0, -1, -2],
      [-1, 1, 0],
      [-2, 0, 0],
    ],
    optimalPath: [matrixCell],
    operations: [{ from: matrixCell, to: { row: 1, col: 1 }, operation: 'MATCH' }],
  };

  it('accepts both DP algorithm ids sharing this shape', () => {
    expect(DpMatrixTraceSchema.safeParse(dpPayload).success).toBe(true);
    expect(
      DpMatrixTraceSchema.safeParse({ ...dpPayload, algorithmId: 'levenshtein' }).success,
    ).toBe(true);
  });

  it('rejects a discriminator outside the DP pair', () => {
    expect(DpMatrixTraceSchema.safeParse({ ...dpPayload, algorithmId: 'jaccard' }).success).toBe(
      false,
    );
  });
});

describe('AlgorithmTraceSchema (runtime, discriminated union)', () => {
  const jaccardPayload = {
    algorithmId: 'jaccard',
    setA: ['alignment', 'sequence'],
    setB: ['alignment', 'similarity'],
    intersectionSize: 1,
    unionSize: 3,
    intersection: ['alignment'],
    union: ['alignment', 'sequence', 'similarity'],
    coefficient: 0.333,
  };

  it('accepts a valid Jaccard trace routed by its discriminator', () => {
    expect(AlgorithmTraceSchema.safeParse(jaccardPayload).success).toBe(true);
  });

  it('rejects a Jaccard-labeled payload shaped like a DP trace (wrong discriminator match)', () => {
    const wronglyShaped = {
      algorithmId: 'jaccard',
      rowLabels: ['A'],
      columnLabels: ['B'],
      matrix: [[0]],
      optimalPath: [],
      operations: [],
    };

    expect(AlgorithmTraceSchema.safeParse(wronglyShaped).success).toBe(false);
  });

  it('rejects an algorithmId this union does not cover', () => {
    expect(
      AlgorithmTraceSchema.safeParse({ ...jaccardPayload, algorithmId: 'unknown-capability' })
        .success,
    ).toBe(false);
  });
});
