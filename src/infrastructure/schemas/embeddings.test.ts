import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import type { components } from '../../shared/types/api';
import {
  EmbeddingApiStatusSchema,
  EmbeddingLocalStatusSchema,
  EmbeddingStatusSchema,
} from './embeddings';

type EmbeddingLocalStatus = components['schemas']['EmbeddingLocalStatus'];
type EmbeddingApiStatus = components['schemas']['EmbeddingApiStatus'];
type EmbeddingStatus = components['schemas']['EmbeddingStatus'];

describe('embeddings schemas (contract)', () => {
  it('EmbeddingLocalStatusSchema matches EmbeddingLocalStatus', () => {
    expectTypeOf<
      z.infer<typeof EmbeddingLocalStatusSchema>
    >().toEqualTypeOf<EmbeddingLocalStatus>();
  });

  it('EmbeddingApiStatusSchema matches EmbeddingApiStatus', () => {
    expectTypeOf<z.infer<typeof EmbeddingApiStatusSchema>>().toEqualTypeOf<EmbeddingApiStatus>();
  });

  it('EmbeddingStatusSchema matches EmbeddingStatus', () => {
    expectTypeOf<z.infer<typeof EmbeddingStatusSchema>>().toEqualTypeOf<EmbeddingStatus>();
  });
});

describe('EmbeddingStatusSchema (runtime)', () => {
  const validPayload = {
    embeddingLocal: {
      provider: 'sentence-transformers',
      model: 'all-MiniLM-L6-v2',
      dimension: 384,
      corpusSha256: 'abc123',
      matchesCorpus: true,
      device: 'cpu',
    },
    embeddingApi: {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimension: 1536,
      corpusSha256: 'abc123',
      matchesCorpus: true,
      mode: 'cached',
    },
  };

  it('accepts a real-shaped status for both embedding families', () => {
    expect(EmbeddingStatusSchema.safeParse(validPayload).success).toBe(true);
  });

  it('accepts embeddingApi mode "live"', () => {
    expect(
      EmbeddingStatusSchema.safeParse({
        ...validPayload,
        embeddingApi: { ...validPayload.embeddingApi, mode: 'live' },
      }).success,
    ).toBe(true);
  });

  it('rejects an embeddingApi mode outside cached/live', () => {
    expect(
      EmbeddingStatusSchema.safeParse({
        ...validPayload,
        embeddingApi: { ...validPayload.embeddingApi, mode: 'stale' },
      }).success,
    ).toBe(false);
  });

  it('rejects a payload missing matchesCorpus on embeddingLocal', () => {
    const { matchesCorpus: _matchesCorpus, ...withoutMatches } = validPayload.embeddingLocal;
    expect(
      EmbeddingStatusSchema.safeParse({ ...validPayload, embeddingLocal: withoutMatches }).success,
    ).toBe(false);
  });
});
