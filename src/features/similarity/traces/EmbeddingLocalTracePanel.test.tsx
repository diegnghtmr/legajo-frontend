import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { EmbeddingLocalTrace } from '../../../infrastructure/schemas/similarity';
import { EmbeddingLocalTracePanel } from './EmbeddingLocalTracePanel';

const TRACE: EmbeddingLocalTrace = {
  algorithmId: 'embedding-local',
  provider: 'sentence-transformers',
  model: 'all-MiniLM-L6-v2',
  dimension: 384,
  vectorAExcerpt: [0.011, -0.022, 0.033, -0.044, 0.055, -0.066, 0.077, -0.088],
  vectorBExcerpt: [0.012, -0.021, 0.032, -0.043, 0.054, -0.065, 0.076, -0.087],
  vectorA: Array.from({ length: 384 }, () => 0.01),
  vectorB: Array.from({ length: 384 }, () => 0.01),
  preNormL2A: 9.8321,
  preNormL2B: 9.7654,
  dotProduct: 0.8123,
  cosine: 0.8177,
  angleDegrees: 35.66,
  normalizedScore: 0.8177,
};

describe('EmbeddingLocalTracePanel', () => {
  it('renders every field of the embedding-local trace from a contract-shaped fixture', () => {
    render(<EmbeddingLocalTracePanel trace={TRACE} />);

    expect(screen.getByTestId('embedding-local-provider')).toHaveTextContent(TRACE.provider);
    expect(screen.getByTestId('embedding-local-model')).toHaveTextContent(TRACE.model);
    expect(screen.getByTestId('embedding-local-dimension')).toHaveTextContent('384');
    expect(screen.getByTestId('embedding-local-vectorA-excerpt')).toHaveTextContent(
      TRACE.vectorAExcerpt.map((v) => v.toFixed(6)).join(', '),
    );
    expect(screen.getByTestId('embedding-local-vectorB-excerpt')).toHaveTextContent(
      TRACE.vectorBExcerpt.map((v) => v.toFixed(6)).join(', '),
    );
    expect(screen.getByTestId('embedding-local-preNormL2A')).toHaveTextContent(
      TRACE.preNormL2A.toFixed(6),
    );
    expect(screen.getByTestId('embedding-local-preNormL2B')).toHaveTextContent(
      TRACE.preNormL2B.toFixed(6),
    );
    expect(screen.getByTestId('embedding-local-dotProduct')).toHaveTextContent(
      TRACE.dotProduct.toFixed(6),
    );
    expect(screen.getByTestId('embedding-local-cosine')).toHaveTextContent(TRACE.cosine.toFixed(6));
    expect(screen.getByTestId('embedding-local-angleDegrees')).toHaveTextContent(
      TRACE.angleDegrees.toFixed(6),
    );
    expect(screen.getByTestId('embedding-local-normalizedScore')).toHaveTextContent(
      TRACE.normalizedScore.toFixed(6),
    );
  });

  it('never renders the full 384-dimension vectors, only their 8-value excerpts', () => {
    render(<EmbeddingLocalTracePanel trace={TRACE} />);

    // The full vectors are all 0.01 (formatted "0.010000"); that value must
    // never appear, since only the excerpts (which differ) are rendered.
    expect(screen.queryByText('0.010000')).not.toBeInTheDocument();
  });
});
