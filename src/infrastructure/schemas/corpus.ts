import { z } from 'zod';

export const CorpusSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
});

export type CorpusSummary = z.infer<typeof CorpusSummarySchema>;

export const CorpusDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  abstract: z.string(),
});

export type CorpusDocument = z.infer<typeof CorpusDocumentSchema>;
