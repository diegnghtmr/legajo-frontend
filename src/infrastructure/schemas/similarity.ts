import { z } from 'zod';

/** The six fixed similarity capability ids. Never translated. */
export const AlgorithmIdSchema = z.enum([
  'levenshtein',
  'needleman-wunsch',
  'jaccard',
  'tfidf-cosine',
  'embedding-local',
  'embedding-api',
]);

export type AlgorithmId = z.infer<typeof AlgorithmIdSchema>;

export const AlgorithmKindSchema = z.enum(['CLASSIC', 'AI']);

export const AlgorithmSummarySchema = z.object({
  id: AlgorithmIdSchema,
  displayName: z.string(),
  kind: AlgorithmKindSchema,
});

/**
 * The common result envelope. Scores are constrained to [0, 1]
 * (every exposed similarity is normalized into that range).
 */
export const SimilarityResultSchema = z.object({
  normalizedScore: z.number().min(0).max(1),
  rawValue: z.number().nullable().optional(),
  computedNanos: z.number().int(),
  cached: z.boolean(),
  degenerate: z.boolean(),
});

export type SimilarityResult = z.infer<typeof SimilarityResultSchema>;

export const AlgorithmSimilaritySchema = z.object({
  algorithmId: AlgorithmIdSchema,
  result: SimilarityResultSchema,
});

const MatrixCellSchema = z.object({
  row: z.number(),
  col: z.number(),
});

const DpOperationKindSchema = z.enum([
  'MATCH',
  'SUBSTITUTION',
  'INSERTION',
  'DELETION',
  'MISMATCH',
  'GAP',
]);

const DpTraceStepSchema = z.object({
  from: MatrixCellSchema,
  to: MatrixCellSchema,
  operation: DpOperationKindSchema,
});

/** Shared by `levenshtein` and `needleman-wunsch`. */
export const DpMatrixTraceSchema = z.object({
  algorithmId: z.enum(['levenshtein', 'needleman-wunsch']),
  rowLabels: z.array(z.string()),
  columnLabels: z.array(z.string()),
  matrix: z.array(z.array(z.number())),
  optimalPath: z.array(MatrixCellSchema),
  operations: z.array(DpTraceStepSchema),
});

export const JaccardTraceSchema = z.object({
  algorithmId: z.literal('jaccard'),
  setA: z.array(z.string()),
  setB: z.array(z.string()),
  intersectionSize: z.number(),
  unionSize: z.number(),
  intersection: z.array(z.string()),
  union: z.array(z.string()),
  coefficient: z.number(),
});

const TfIdfTermTraceSchema = z.object({
  term: z.string(),
  frequencyA: z.number(),
  frequencyB: z.number(),
  documentFrequency: z.number(),
  tfA: z.number(),
  tfB: z.number(),
  idf: z.number(),
  rawWeightA: z.number(),
  rawWeightB: z.number(),
  normalizedWeightA: z.number(),
  normalizedWeightB: z.number(),
});

export const TfIdfCosineTraceSchema = z.object({
  algorithmId: z.literal('tfidf-cosine'),
  corpusSize: z.number(),
  terms: z.array(TfIdfTermTraceSchema),
  dotProduct: z.number(),
  rawNormA: z.number(),
  rawNormB: z.number(),
  cosine: z.number(),
  angleDegrees: z.number(),
});

export const EmbeddingLocalTraceSchema = z.object({
  algorithmId: z.literal('embedding-local'),
  provider: z.string(),
  model: z.string(),
  dimension: z.number(),
  vectorAExcerpt: z.array(z.number()),
  vectorBExcerpt: z.array(z.number()),
  vectorA: z.array(z.number()),
  vectorB: z.array(z.number()),
  preNormL2A: z.number(),
  preNormL2B: z.number(),
  dotProduct: z.number(),
  cosine: z.number(),
  angleDegrees: z.number(),
  normalizedScore: z.number(),
});

export const EmbeddingApiTraceSchema = z.object({
  algorithmId: z.literal('embedding-api'),
  provider: z.string(),
  model: z.string(),
  dimension: z.number(),
  vectorAExcerpt: z.array(z.number()),
  vectorBExcerpt: z.array(z.number()),
  vectorA: z.array(z.number()),
  vectorB: z.array(z.number()),
  preNormL2A: z.number(),
  preNormL2B: z.number(),
  sumSquaredDiff: z.number(),
  distance: z.number(),
  normalizedScore: z.number(),
  providerStatus: z.string(),
});

/**
 * One variant per similarity capability. Routed by the
 * `algorithmId` discriminator; `levenshtein`/`needleman-wunsch` share
 * `DpMatrixTraceSchema`, whose discriminator is a two-value enum rather than
 * a single literal (Zod 4's `discriminatedUnion` supports that).
 */
export const AlgorithmTraceSchema = z.discriminatedUnion('algorithmId', [
  DpMatrixTraceSchema,
  JaccardTraceSchema,
  TfIdfCosineTraceSchema,
  EmbeddingLocalTraceSchema,
  EmbeddingApiTraceSchema,
]);

export type AlgorithmTrace = z.infer<typeof AlgorithmTraceSchema>;

// Per-branch types, so a trace panel can declare it renders exactly one
// variant instead of narrowing `AlgorithmTrace` by hand at every call site.
export type DpMatrixTrace = z.infer<typeof DpMatrixTraceSchema>;
export type JaccardTrace = z.infer<typeof JaccardTraceSchema>;
export type TfIdfCosineTrace = z.infer<typeof TfIdfCosineTraceSchema>;
export type EmbeddingLocalTrace = z.infer<typeof EmbeddingLocalTraceSchema>;
export type EmbeddingApiTrace = z.infer<typeof EmbeddingApiTraceSchema>;
