import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import type { components } from '../../shared/types/api';
import { CorpusDocumentSchema, CorpusSummarySchema } from './corpus';

type CorpusSummary = components['schemas']['CorpusSummary'];
type CorpusDocument = components['schemas']['CorpusDocument'];

describe('corpus schemas (contract)', () => {
  it('CorpusSummarySchema is mutually assignable with the generated CorpusSummary', () => {
    expectTypeOf<z.infer<typeof CorpusSummarySchema>>().toEqualTypeOf<CorpusSummary>();
  });

  it('CorpusDocumentSchema is mutually assignable with the generated CorpusDocument', () => {
    expectTypeOf<z.infer<typeof CorpusDocumentSchema>>().toEqualTypeOf<CorpusDocument>();
  });
});

describe('corpus schemas (runtime)', () => {
  it('accepts a real-shaped CorpusSummary', () => {
    const result = CorpusSummarySchema.safeParse({
      id: 'doc-01',
      title: 'A Study of Sequence Alignment',
      authors: ['A. Author', 'B. Author'],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a CorpusSummary missing authors', () => {
    const result = CorpusSummarySchema.safeParse({ id: 'doc-01', title: 'Title' });

    expect(result.success).toBe(false);
  });

  it('accepts a real-shaped CorpusDocument, including the abstract', () => {
    const result = CorpusDocumentSchema.safeParse({
      id: 'doc-01',
      title: 'A Study of Sequence Alignment',
      authors: ['A. Author'],
      abstract: 'This paper compares six similarity capabilities...',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a CorpusDocument missing the abstract', () => {
    const result = CorpusDocumentSchema.safeParse({
      id: 'doc-01',
      title: 'Title',
      authors: ['A. Author'],
    });

    expect(result.success).toBe(false);
  });
});
