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
  it('accepts a real-shaped linkage result', () => {
    const payload = {
      linkageId: 'ward',
      linkageDisplayName: 'Ward',
      rows: [{ idx1: 0, idx2: 1, mergeDistance: 0.12, size: 2 }],
      leafOrder: [0, 1, 2],
      evaluation: {
        cophenetic: 0.8,
        meanSilhouette: { '2': 0.5 },
        daviesBouldin: { '2': null },
      },
    };

    expect(LinkageResultSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown linkageId', () => {
    const payload = {
      linkageId: 'centroid',
      linkageDisplayName: 'Centroid',
      rows: [],
      leafOrder: [],
      evaluation: { cophenetic: 0, meanSilhouette: {}, daviesBouldin: {} },
    };

    expect(LinkageResultSchema.safeParse(payload).success).toBe(false);
  });
});

describe('ClusterAssignmentSchema (runtime)', () => {
  it('accepts labels plus k', () => {
    expect(ClusterAssignmentSchema.safeParse({ labels: [0, 0, 1, 1], k: 2 }).success).toBe(true);
  });

  it('rejects a payload missing k', () => {
    expect(ClusterAssignmentSchema.safeParse({ labels: [0, 1] }).success).toBe(false);
  });
});
