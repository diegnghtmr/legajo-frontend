import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { EmbeddingTiles, EmbeddingTilesSkeleton } from './EmbeddingTiles';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

function result(overrides: Partial<BenchmarkResult>): BenchmarkResult {
  return {
    benchmark: 'x',
    family: 'embedding-dot-product',
    parameter: 'dimension',
    size: 384,
    score: 195,
    error: 10,
    unit: 'ns/op',
    ...overrides,
  };
}

const RESULTS: BenchmarkResult[] = [
  result({ family: 'embedding-dot-product', size: 384, score: 195 }),
  result({ family: 'embedding-euclidean-sum-squared', size: 384, score: 210 }),
  result({ family: 'embedding-dot-product', size: 1536, score: 842 }),
  result({ family: 'embedding-euclidean-sum-squared', size: 1536, score: 866 }),
];

describe('EmbeddingTiles', () => {
  it('renders one tile per embedding dimension, no curve', () => {
    render(<EmbeddingTiles results={RESULTS} />);

    const tile384 = screen.getByTestId('embedding-tile-384');
    const tile1536 = screen.getByTestId('embedding-tile-1536');

    expect(within(tile384).getByText('dot-product')).toBeInTheDocument();
    expect(within(tile384).getByText('195 ns')).toBeInTheDocument();
    expect(within(tile384).getAllByText('±10 ns')).toHaveLength(2);
    expect(within(tile384).getByText('euclidean-sum-squared')).toBeInTheDocument();
    expect(within(tile384).getByText('210 ns')).toBeInTheDocument();

    expect(within(tile1536).getByText('842 ns')).toBeInTheDocument();
    expect(within(tile1536).getByText('866 ns')).toBeInTheDocument();

    // No chart/curve elements for embedding tiles.
    expect(tile384.querySelector('svg')).not.toBeInTheDocument();
    expect(tile1536.querySelector('svg')).not.toBeInTheDocument();
  });

  it('names each dimension in a sunken tile under one section heading', () => {
    render(<EmbeddingTiles results={RESULTS} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Primitivas de embeddings (O(d))' }),
    ).toBeInTheDocument();
    const tile = screen.getByTestId('embedding-tile-384');
    expect(within(tile).getByText('d = 384')).toBeInTheDocument();
    expect(tile.className).toContain('bg-paper-sunken');
  });

  it('puts the tiles side by side in two equal columns that fill the card', () => {
    render(<EmbeddingTiles results={RESULTS} />);

    const grid = screen.getByTestId('embedding-tile-384').parentElement!;
    expect(grid.className).toContain('grid-cols-2');
    expect(grid.className).toContain('flex-1');
  });

  it('shows each primitive as one line: the mono name at the start, the duration and the quieter error at the end', () => {
    render(<EmbeddingTiles results={RESULTS} />);

    const tile = screen.getByTestId('embedding-tile-1536');
    const name = within(tile).getByText('dot-product');
    expect(name.className).toContain('font-mono');
    expect(name.className).toContain('text-ink-secondary');
    const error = within(tile).getAllByText('±10 ns')[0]!;
    expect(error.className).toContain('text-ink-secondary');
    expect(error.parentElement).toHaveTextContent('842 ns ±10 ns');
    expect(error.parentElement).toBe(name.nextElementSibling);
    expect(within(tile).queryByText('embedding-dot-product')).not.toBeInTheDocument();
  });

  it('omits a primitive that has no measurement for that dimension', () => {
    render(
      <EmbeddingTiles
        results={[result({ family: 'embedding-dot-product', size: 384, score: 195 })]}
      />,
    );

    const tile = screen.getByTestId('embedding-tile-384');
    expect(within(tile).getByText('dot-product')).toBeInTheDocument();
    expect(within(tile).queryByText('euclidean-sum-squared')).not.toBeInTheDocument();
  });

  it('omits the error when a primitive reports none', () => {
    render(
      <EmbeddingTiles
        results={[result({ family: 'embedding-dot-product', size: 384, error: 0 })]}
      />,
    );

    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
  });

  it('renders nothing when there are no embedding results', () => {
    const { container } = render(<EmbeddingTiles results={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('omits a result with an unrecognized unit instead of throwing during render', () => {
    const withMalformedUnit: BenchmarkResult[] = [
      ...RESULTS,
      result({ family: 'embedding-dot-product', size: 768, score: 400, unit: 'op/s' }),
    ];

    expect(() => render(<EmbeddingTiles results={withMalformedUnit} />)).not.toThrow();
    expect(screen.queryByTestId('embedding-tile-768')).not.toBeInTheDocument();
  });
});

describe('EmbeddingTilesSkeleton', () => {
  it('mirrors the tiles: the same heading, one tile per known dimension, real ids and bars for values', () => {
    render(<EmbeddingTilesSkeleton />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Primitivas de embeddings (O(d))' }),
    ).toBeInTheDocument();
    for (const dimension of [384, 1536]) {
      const tile = screen.getByTestId(`embedding-tile-skeleton-${dimension}`);
      expect(tile.className).toContain('bg-paper-sunken');
      expect(within(tile).getByText(`d = ${dimension}`)).toBeInTheDocument();
      expect(within(tile).getByText('dot-product')).toBeInTheDocument();
      expect(tile.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    }
  });
});
