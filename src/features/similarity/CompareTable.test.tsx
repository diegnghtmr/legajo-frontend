import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { CompareTable } from './CompareTable';

const CATALOGUE = new Map<string, ListSimilarityAlgorithmsResponse[number]>([
  ['levenshtein', { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' }],
  ['tfidf-cosine', { id: 'tfidf-cosine', displayName: 'TF-IDF cosine', kind: 'CLASSIC' }],
  ['embedding-api', { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' }],
]);

const ROWS: CompareResponse = [
  {
    algorithmId: 'levenshtein',
    result: {
      normalizedScore: 0.5,
      rawValue: 12,
      computedNanos: 1234567,
      cached: false,
      degenerate: false,
    },
  },
  {
    algorithmId: 'tfidf-cosine',
    result: {
      normalizedScore: 0,
      rawValue: null,
      computedNanos: 900,
      cached: false,
      degenerate: true,
    },
  },
  {
    algorithmId: 'embedding-api',
    result: {
      normalizedScore: 0.9,
      rawValue: 0.10000001,
      computedNanos: 42,
      cached: true,
      degenerate: false,
    },
  },
];

function renderTable() {
  return render(
    <MemoryRouter>
      <CompareTable
        rows={ROWS}
        catalogueById={CATALOGUE}
        documentIdA="doc-01"
        documentIdB="doc-02"
      />
    </MemoryRouter>,
  );
}

describe('CompareTable', () => {
  it('renders one row per result with the mono algorithm id linking to its trace route', () => {
    renderTable();

    const link = screen.getByRole('link', { name: /levenshtein/i });
    expect(link).toHaveAttribute(
      'href',
      '/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02',
    );
    expect(screen.getByText('Levenshtein distance')).toBeInTheDocument();
  });

  it('shows a dash and accessible text for a null raw value, and the degenerate indicator', () => {
    renderTable();

    const degenerateRow = screen.getByRole('row', { name: /tfidf-cosine/i });
    expect(within(degenerateRow).getByText('—')).toBeInTheDocument();
    expect(
      within(degenerateRow).getByText('No aplica en este caso degenerado'),
    ).toBeInTheDocument();
    expect(within(degenerateRow).getByText('Sí')).toBeInTheDocument();
  });

  it('shows the cached marker only for a cached row', () => {
    renderTable();

    const cachedRow = screen.getByRole('row', { name: /embedding-api/i });
    expect(within(cachedRow).getByText('en caché')).toBeInTheDocument();

    const nonCachedRow = screen.getByRole('row', { name: /^levenshtein/i });
    expect(within(nonCachedRow).queryByText('en caché')).not.toBeInTheDocument();
  });

  it('formats computedNanos with locale thousands separators', () => {
    renderTable();

    expect(screen.getByText('1.234.567')).toBeInTheDocument();
  });

  it('renders a numeric raw value in mono for a non-degenerate row', () => {
    renderTable();

    const row = screen.getByRole('row', { name: /^levenshtein/i });
    expect(within(row).getByText('12')).toBeInTheDocument();
  });
});
