import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import type { components } from '../../shared/types/api';
import {
  ClusterAssignmentSchema,
  ClusteringEvaluationSchema,
  LinkageEvaluationSchema,
  LinkageIdSchema,
  LinkageResultSchema,
  LinkageStepSchema,
  RepresentationIdSchema,
} from './clustering';

type LinkageStep = components['schemas']['LinkageStep'];
type ClusteringEvaluation = components['schemas']['ClusteringEvaluation'];
type LinkageResult = components['schemas']['LinkageResult'];
type LinkageEvaluation = components['schemas']['LinkageEvaluation'];
type ClusterAssignment = components['schemas']['ClusterAssignment'];

describe('clustering schemas (contract)', () => {
  it('LinkageStepSchema matches LinkageStep', () => {
    expectTypeOf<z.infer<typeof LinkageStepSchema>>().toEqualTypeOf<LinkageStep>();
  });

  it('ClusteringEvaluationSchema matches ClusteringEvaluation', () => {
    expectTypeOf<
      z.infer<typeof ClusteringEvaluationSchema>
    >().toEqualTypeOf<ClusteringEvaluation>();
  });

  it('LinkageResultSchema matches LinkageResult', () => {
    expectTypeOf<z.infer<typeof LinkageResultSchema>>().toEqualTypeOf<LinkageResult>();
  });

  it('LinkageEvaluationSchema matches LinkageEvaluation', () => {
    expectTypeOf<z.infer<typeof LinkageEvaluationSchema>>().toEqualTypeOf<LinkageEvaluation>();
  });

  it('ClusterAssignmentSchema matches ClusterAssignment', () => {
    expectTypeOf<z.infer<typeof ClusterAssignmentSchema>>().toEqualTypeOf<ClusterAssignment>();
  });
});

describe('LinkageIdSchema', () => {
  it('accepts exactly the four fixed linkage criteria, Ward included', () => {
    expect(LinkageIdSchema.options).toEqual(['single', 'complete', 'average', 'ward']);
  });
});

describe('RepresentationIdSchema', () => {
  it('accepts exactly the three fixed representations, tfidf-cosine first (the default)', () => {
    expect(RepresentationIdSchema.options).toEqual([
      'tfidf-cosine',
      'embedding-local',
      'embedding-api',
    ]);
  });

  it('rejects an unknown representation', () => {
    expect(RepresentationIdSchema.safeParse('bm25').success).toBe(false);
  });
});

describe('ClusteringEvaluationSchema (runtime)', () => {
  const validPayload = {
    cophenetic: 0.842,
    meanSilhouette: { '2': 0.51, '3': 0.44 },
    daviesBouldin: { '2': 0.9, '3': null },
  };

  it('accepts a real-shaped evaluation with a null daviesBouldin at some k', () => {
    expect(ClusteringEvaluationSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects a daviesBouldin value that is neither a number nor null', () => {
    expect(
      ClusteringEvaluationSchema.safeParse({
        ...validPayload,
        daviesBouldin: { '2': 'not-a-number' },
      }).success,
    ).toBe(false);
  });

  it('rejects a payload missing meanSilhouette', () => {
    const { meanSilhouette: _meanSilhouette, ...withoutMeanSilhouette } = validPayload;
    expect(ClusteringEvaluationSchema.safeParse(withoutMeanSilhouette).success).toBe(false);
  });
});

describe('LinkageResultSchema (runtime)', () => {
  const validPayload = {
    linkageId: 'ward',
    linkageDisplayName: 'Ward',
    rows: [{ idx1: 0, idx2: 1, mergeDistance: 0.12, size: 2 }],
    leafOrder: [0, 1, 2],
    documentIds: ['doc-01', 'doc-02', 'doc-03'],
    evaluation: {
      cophenetic: 0.8,
      meanSilhouette: { '2': 0.5 },
      daviesBouldin: { '2': null },
    },
  };

  it('accepts a real-shaped linkage result', () => {
    expect(LinkageResultSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects an unknown linkageId', () => {
    const payload = {
      linkageId: 'centroid',
      linkageDisplayName: 'Centroid',
      rows: [],
      leafOrder: [],
      documentIds: [],
      evaluation: { cophenetic: 0, meanSilhouette: {}, daviesBouldin: {} },
    };

    expect(LinkageResultSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a payload missing documentIds', () => {
    const { documentIds: _documentIds, ...withoutDocumentIds } = validPayload;
    expect(LinkageResultSchema.safeParse(withoutDocumentIds).success).toBe(false);
  });

  it('rejects an empty documentIds', () => {
    expect(LinkageResultSchema.safeParse({ ...validPayload, documentIds: [] }).success).toBe(false);
  });

  it('rejects documentIds shorter than leafOrder (n mismatch)', () => {
    expect(
      LinkageResultSchema.safeParse({ ...validPayload, documentIds: ['doc-01', 'doc-02'] }).success,
    ).toBe(false);
  });

  it('rejects duplicate documentIds (same length as leafOrder, but not one entry per observation)', () => {
    expect(
      LinkageResultSchema.safeParse({
        ...validPayload,
        documentIds: ['doc-01', 'doc-01', 'doc-03'],
      }).success,
    ).toBe(false);
  });
});

describe('ClusterAssignmentSchema (runtime)', () => {
  const validPayload = { labels: [0, 0, 1, 1], k: 2, documentIds: ['a', 'b', 'c', 'd'] };

  it('accepts labels plus k plus documentIds', () => {
    expect(ClusterAssignmentSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects a payload missing k', () => {
    const { k: _k, ...withoutK } = validPayload;
    expect(ClusterAssignmentSchema.safeParse(withoutK).success).toBe(false);
  });

  it('rejects a payload missing documentIds', () => {
    const { documentIds: _documentIds, ...withoutDocumentIds } = validPayload;
    expect(ClusterAssignmentSchema.safeParse(withoutDocumentIds).success).toBe(false);
  });

  it('rejects an empty documentIds', () => {
    expect(ClusterAssignmentSchema.safeParse({ ...validPayload, documentIds: [] }).success).toBe(
      false,
    );
  });

  it('rejects documentIds shorter than labels (n mismatch)', () => {
    expect(
      ClusterAssignmentSchema.safeParse({ ...validPayload, documentIds: ['a', 'b'] }).success,
    ).toBe(false);
  });

  it('rejects duplicate documentIds (same length as labels, but not one entry per observation)', () => {
    expect(
      ClusterAssignmentSchema.safeParse({ ...validPayload, documentIds: ['a', 'a', 'c', 'd'] })
        .success,
    ).toBe(false);
  });
});
