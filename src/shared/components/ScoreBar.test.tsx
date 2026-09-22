import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScoreBar } from './ScoreBar';

describe('ScoreBar', () => {
  it('exposes a meter with min 0, max 1 and the exact value at the minimum (0)', () => {
    render(<ScoreBar value={0} family="classic" label="Levenshtein score" />);

    const meter = screen.getByRole('meter', { name: 'Levenshtein score' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '1');
    expect(meter).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('0.000')).toBeInTheDocument();
  });

  it('reports the exact value at the midpoint (0.5)', () => {
    render(<ScoreBar value={0.5} family="ai" label="Cosine score" />);

    expect(screen.getByRole('meter', { name: 'Cosine score' })).toHaveAttribute(
      'aria-valuenow',
      '0.5',
    );
    expect(screen.getByText('0.500')).toBeInTheDocument();
  });

  it('reports the exact value at the maximum (1)', () => {
    render(<ScoreBar value={1} family="classic" label="Jaccard score" />);

    expect(screen.getByRole('meter', { name: 'Jaccard score' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(screen.getByText('1.000')).toBeInTheDocument();
  });
});
