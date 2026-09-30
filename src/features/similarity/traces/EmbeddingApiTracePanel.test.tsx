import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { EmbeddingApiTrace } from '../../../infrastructure/schemas/similarity';
import { EmbeddingApiTracePanel } from './EmbeddingApiTracePanel';

const TRACE: EmbeddingApiTrace = {
  algorithmId: 'embedding-api',
  stemming: false,
  provider: 'google',
  model: 'gemini-embedding-2-preview',
  dimension: 1536,
  vectorAExcerpt: [0.111, -0.222, 0.333, -0.444, 0.555, -0.666, 0.777, -0.888],
  vectorBExcerpt: [0.112, -0.221, 0.332, -0.443, 0.554, -0.665, 0.776, -0.887],
  vectorA: Array.from({ length: 1536 }, () => 0.02),
  vectorB: Array.from({ length: 1536 }, () => 0.02),
  preNormL2A: 12.3456,
  preNormL2B: 12.9876,
  sumSquaredDiff: 0.3456,
  distance: 0.5879,
  normalizedScore: 0.5844,
  providerStatus: 'cached',
};

describe('EmbeddingApiTracePanel', () => {
  it('renders every field of the embedding-api trace from a contract-shaped fixture', () => {
    render(<EmbeddingApiTracePanel trace={TRACE} />);

    expect(screen.getByTestId('embedding-api-provider')).toHaveTextContent(TRACE.provider);
    expect(screen.getByTestId('embedding-api-model')).toHaveTextContent(TRACE.model);
    expect(screen.getByTestId('embedding-api-dimension')).toHaveTextContent('1536');
    expect(screen.getByTestId('embedding-api-vectorA-excerpt')).toHaveTextContent(
      TRACE.vectorAExcerpt.map((v) => v.toFixed(6)).join(', '),
    );
    expect(screen.getByTestId('embedding-api-vectorB-excerpt')).toHaveTextContent(
      TRACE.vectorBExcerpt.map((v) => v.toFixed(6)).join(', '),
    );
    expect(screen.getByTestId('embedding-api-preNormL2A')).toHaveTextContent(
      TRACE.preNormL2A.toFixed(6),
    );
    expect(screen.getByTestId('embedding-api-preNormL2B')).toHaveTextContent(
      TRACE.preNormL2B.toFixed(6),
    );
    expect(screen.getByTestId('embedding-api-sumSquaredDiff')).toHaveTextContent(
      TRACE.sumSquaredDiff.toFixed(6),
    );
    expect(screen.getByTestId('embedding-api-distance')).toHaveTextContent(
      TRACE.distance.toFixed(6),
    );
    expect(screen.getByTestId('embedding-api-normalizedScore')).toHaveTextContent(
      TRACE.normalizedScore.toFixed(6),
    );
    expect(screen.getByTestId('embedding-api-providerStatus')).toHaveTextContent(
      TRACE.providerStatus,
    );
  });

  it('never renders the full 1536-dimension vectors, only their 8-value excerpts', () => {
    render(<EmbeddingApiTracePanel trace={TRACE} />);

    expect(screen.queryByText('0.020000')).not.toBeInTheDocument();
  });
});
