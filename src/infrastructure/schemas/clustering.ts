import { z } from 'zod';

/** The four fixed linkage criteria (TRD §6.4), Ward included (TAC-03). */
export const LinkageIdSchema = z.enum(['single', 'complete', 'average', 'ward']);
export type LinkageId = z.infer<typeof LinkageIdSchema>;

/**
 * The three fixed vector-space representations `POST /clustering*` accepts
 * (TRD §6.6). Not `$ref`'d in the generated OpenAPI types (inlined instead,
 * see `api.ts`'s doc comment on `ClusteringRequest.representation`), so
 * there is no generated type to contract-test this schema against — the
 * runtime `.options` check below is the equivalent of `LinkageIdSchema`'s
 * own test.
 */
export const RepresentationIdSchema = z.enum(['tfidf-cosine', 'embedding-local', 'embedding-api']);
export type RepresentationId = z.infer<typeof RepresentationIdSchema>;

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

/**
 * `documentIds[i]` is the id of the document behind observation `i` — the
 * same index `idx1`/`idx2` (< n) and `leafOrder` use, in the order of
 * `corpus.json`/`GET /corpus` (TRD 1.3.9). Required and non-empty: the UI
 * must never fall back to assuming leaf *i* is the *i*-th `GET /corpus`
 * item. The refinement below only guards the two array lengths agreeing
 * (both carry n); it says nothing about ordering, which is the backend's
 * contract to keep.
 */
export const LinkageResultSchema = z
  .object({
    linkageId: LinkageIdSchema,
    linkageDisplayName: z.string(),
    rows: z.array(LinkageStepSchema),
    leafOrder: z.array(z.number()),
    documentIds: z.array(z.string()).min(1),
    evaluation: ClusteringEvaluationSchema,
  })
  .refine((value) => value.documentIds.length === value.leafOrder.length, {
    message: 'documentIds must have exactly one entry per observation (same length as leafOrder)',
    path: ['documentIds'],
  })
  .refine((value) => new Set(value.documentIds).size === value.documentIds.length, {
    message: 'documentIds must not contain duplicates (one entry per observation)',
    path: ['documentIds'],
  });

export const LinkageEvaluationSchema = z.object({
  linkageId: LinkageIdSchema,
  linkageDisplayName: z.string(),
  evaluation: ClusteringEvaluationSchema,
});

/**
 * `documentIds[i]` is the document whose cluster is `labels[i]` (TRD 1.3.9),
 * in the order of `corpus.json`/`GET /corpus`. Required and non-empty for
 * the same reason as `LinkageResultSchema.documentIds`.
 */
export const ClusterAssignmentSchema = z
  .object({
    labels: z.array(z.number()),
    k: z.number(),
    documentIds: z.array(z.string()).min(1),
  })
  .refine((value) => value.documentIds.length === value.labels.length, {
    message: 'documentIds must have exactly one entry per observation (same length as labels)',
    path: ['documentIds'],
  })
  .refine((value) => new Set(value.documentIds).size === value.documentIds.length, {
    message: 'documentIds must not contain duplicates (one entry per observation)',
    path: ['documentIds'],
  });
