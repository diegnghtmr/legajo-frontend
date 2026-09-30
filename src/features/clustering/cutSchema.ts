import { z } from 'zod';

import { LinkageIdSchema } from '../../infrastructure/schemas/clustering';

export interface CutKRange {
  min: number;
  max: number;
  /** False once `n - 1 < 2` (n < 3): no `k` exists and the range would read inverted. */
  hasRange: boolean;
}

const MIN_CUT_K = 2;

/** The contract's own bound for a free cut: `k` is an integer in `[2, n - 1]`. */
export function cutKRange(n: number): CutKRange {
  return { min: MIN_CUT_K, max: n - 1, hasRange: n - 1 >= MIN_CUT_K };
}

/** The free-cut request's editable part, validated against the contract's own bound. */
export function buildCutSchema(n: number) {
  return z.object({
    linkage: LinkageIdSchema,
    k: z
      .number()
      .int()
      .min(MIN_CUT_K)
      .max(n - 1),
  });
}

export function isValidCutK(k: number, n: number): boolean {
  return buildCutSchema(n).shape.k.safeParse(k).success;
}

/** The cut's `k` before the user edits it: four, or the largest valid `k` when the corpus is smaller. */
export function defaultCutK(n: number): number {
  return Math.min(4, n - 1);
}
