import { z } from 'zod';

export const EmbeddingLocalStatusSchema = z.object({
  provider: z.string(),
  model: z.string(),
  dimension: z.number(),
  corpusSha256: z.string(),
  matchesCorpus: z.boolean(),
  /** Fixed literal "cpu" today (TRD §14.2, CPU-only default). */
  device: z.string(),
});

export const EmbeddingApiStatusSchema = z.object({
  provider: z.string(),
  model: z.string(),
  dimension: z.number(),
  corpusSha256: z.string(),
  matchesCorpus: z.boolean(),
  /** The only capability with a live-update path (NFR-QA-12). */
  mode: z.enum(['cached', 'live']),
});

export const EmbeddingStatusSchema = z.object({
  embeddingLocal: EmbeddingLocalStatusSchema,
  embeddingApi: EmbeddingApiStatusSchema,
});
