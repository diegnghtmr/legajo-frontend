import { z } from 'zod';

/**
 * The seven fixed `urn:legajo:problem:*` URNs (TRD §6.6, "Códigos de estado
 * de error (fijados)"). A framework-detected error carries no `type` at all
 * (Spring's `about:blank` is the implicit default and never appears in the
 * serialized body) rather than one of these values.
 */
export const ProblemTypeSchema = z.enum([
  'urn:legajo:problem:unknown-document',
  'urn:legajo:problem:unknown-algorithm',
  'urn:legajo:problem:unknown-representation',
  'urn:legajo:problem:unknown-linkage',
  'urn:legajo:problem:invalid-cut',
  'urn:legajo:problem:invalid-selection',
  'urn:legajo:problem:embedding-api-unavailable',
]);

export type ProblemType = z.infer<typeof ProblemTypeSchema>;

/** RFC 9457 Problem Detail, as Spring Framework 7 serializes it (TRD §6.6). */
export const ProblemDetailSchema = z.object({
  type: ProblemTypeSchema.optional(),
  title: z.string(),
  status: z.number(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});

export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;
