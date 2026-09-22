import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TfIdfCosineTrace } from '../../../infrastructure/schemas/similarity';
import { TfIdfTracePanel } from './TfIdfTracePanel';

const TRACE: TfIdfCosineTrace = {
  algorithmId: 'tfidf-cosine',
  corpusSize: 20,
  terms: [
    {
      term: 'algorithm',
      frequencyA: 2,
      frequencyB: 1,
      documentFrequency: 5,
      tfA: 1.6931,
      tfB: 1.1001,
      idf: 2.3979,
      rawWeightA: 4.0596,
      rawWeightB: 2.6383,
      normalizedWeightA: 0.7071,
      normalizedWeightB: 0.6001,
    },
    {
      term: 'similarity',
      frequencyA: 1,
      frequencyB: 3,
      documentFrequency: 8,
      tfA: 1.1102,
      tfB: 2.0986,
      idf: 1.9924,
      rawWeightA: 2.2129,
      rawWeightB: 4.1815,
      normalizedWeightA: 0.3464,
      normalizedWeightB: 0.8001,
    },
  ],
  dotProduct: 0.72,
  rawNormA: 4.4885,
  rawNormB: 4.7015,
  cosine: 0.7266,
  angleDegrees: 43.36,
};

describe('TfIdfTracePanel', () => {
  it('renders every term-level and summary field from a contract-shaped fixture', () => {
    render(<TfIdfTracePanel trace={TRACE} />);

    expect(screen.getByText('20')).toBeInTheDocument(); // corpusSize

    const table = screen.getByRole('table');
    for (const row of TRACE.terms) {
      const tableRow = screen.getByRole('row', { name: new RegExp(row.term) });
      const scoped = within(tableRow);
      expect(scoped.getByText(row.term)).toBeInTheDocument();
      expect(scoped.getByText(String(row.frequencyA))).toBeInTheDocument();
      expect(scoped.getByText(String(row.frequencyB))).toBeInTheDocument();
      expect(scoped.getByText(String(row.documentFrequency))).toBeInTheDocument();
      expect(scoped.getByText(row.tfA.toFixed(6))).toBeInTheDocument();
      expect(scoped.getByText(row.tfB.toFixed(6))).toBeInTheDocument();
      expect(scoped.getByText(row.idf.toFixed(6))).toBeInTheDocument();
      expect(scoped.getByText(row.rawWeightA.toFixed(6))).toBeInTheDocument();
      expect(scoped.getByText(row.rawWeightB.toFixed(6))).toBeInTheDocument();
      expect(scoped.getByText(row.normalizedWeightA.toFixed(6))).toBeInTheDocument();
      expect(scoped.getByText(row.normalizedWeightB.toFixed(6))).toBeInTheDocument();
    }
    expect(within(table).getAllByRole('row')).toHaveLength(TRACE.terms.length + 1);

    expect(screen.getByText(TRACE.dotProduct.toFixed(6))).toBeInTheDocument();
    expect(screen.getByText(TRACE.rawNormA.toFixed(6))).toBeInTheDocument();
    expect(screen.getByText(TRACE.rawNormB.toFixed(6))).toBeInTheDocument();
    expect(screen.getByText(TRACE.cosine.toFixed(6))).toBeInTheDocument();
    expect(screen.getByText(TRACE.angleDegrees.toFixed(6))).toBeInTheDocument();
  });

  it('renders one KaTeX formula caption for the cosine/angle formula', async () => {
    const { container } = render(<TfIdfTracePanel trace={TRACE} />);

    const figure = container.querySelector('figure');
    expect(figure).not.toBeNull();
    expect(figure).toHaveTextContent(/coseno/i);
  });
});
