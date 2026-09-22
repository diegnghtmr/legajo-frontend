import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { JaccardTrace } from '../../../infrastructure/schemas/similarity';
import { JaccardTracePanel } from './JaccardTracePanel';

const TRACE: JaccardTrace = {
  algorithmId: 'jaccard',
  setA: ['token-a', 'token-b', 'token-c'],
  setB: ['token-b', 'token-c', 'token-d'],
  intersectionSize: 2,
  unionSize: 4,
  intersection: ['token-b', 'token-c'],
  union: ['token-a', 'token-b', 'token-c', 'token-d'],
  coefficient: 0.5,
};

describe('JaccardTracePanel', () => {
  it('renders every field of the Jaccard trace from a contract-shaped fixture', () => {
    const { container } = render(<JaccardTracePanel trace={TRACE} />);

    for (const term of [...TRACE.setA, ...TRACE.setB]) {
      expect(container).toHaveTextContent(term);
    }
    expect(screen.getByText('2')).toBeInTheDocument(); // intersectionSize
    expect(screen.getByText('4')).toBeInTheDocument(); // unionSize
    expect(screen.getByText('0.500000')).toBeInTheDocument(); // coefficient
  });

  it('lists the intersection and union token sets separately from A and B', () => {
    render(<JaccardTracePanel trace={TRACE} />);

    const intersectionRegion = screen.getByRole('region', { name: /intersecci/i });
    expect(intersectionRegion).toHaveTextContent('token-b');
    expect(intersectionRegion).toHaveTextContent('token-c');
    expect(within(intersectionRegion).queryByText(/token-a\b/)).not.toBeInTheDocument();

    const unionRegion = screen.getByRole('region', { name: /uni[oó]n/i });
    expect(unionRegion).toHaveTextContent('token-d');
  });
});
