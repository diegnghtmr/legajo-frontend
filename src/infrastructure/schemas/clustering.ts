import { z } from 'zod';

/** The four fixed linkage criteria (TRD §6.4), Ward included (TAC-03). */
export const LinkageIdSchema = z.enum(['single', 'complete', 'average', 'ward']);

/** One row of a linkage matrix (TRD §6.4). `idx1 < idx2` always. */
export const LinkageStepSchema = z.object({
  idx1: z.number(),
  idx2: z.number(),
  mergeDistance: z.number(),
  size: z.number(),
});

/**
 * `meanSilhouette`/`daviesBouldin` are keyed by the fixed cut k as a string
 * (JSON object keys are always strings, e.g. "2".."5" — TAC-04).
 * `daviesBouldin` is number-or-null per k: null when a k's centroids
 * coincide (TRD §6.5).
 */
export const ClusteringEvaluationSchema = z.object({
  cophenetic: z.number(),
  meanSilhouette: z.record(z.string(), z.number()),
  daviesBouldin: z.record(z.string(), z.number().nullable()),
});

export const LinkageResultSchema = z.object({
  linkageId: LinkageIdSchema,
  linkageDisplayName: z.string(),
  rows: z.array(LinkageStepSchema),
  leafOrder: z.array(z.number()),
  evaluation: ClusteringEvaluationSchema,
});

export const LinkageEvaluationSchema = z.object({
  linkageId: LinkageIdSchema,
  linkageDisplayName: z.string(),
  evaluation: ClusteringEvaluationSchema,
});

export const ClusterAssignmentSchema = z.object({
  labels: z.array(z.number()),
  k: z.number(),
});
