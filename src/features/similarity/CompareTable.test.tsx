import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

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

function renderTable(
  overrides: Partial<{
    onOpenTrace: (algorithmId: string) => void;
    openAlgorithmId: string | null;
  }> = {},
) {
  const onOpenTrace = overrides.onOpenTrace ?? vi.fn();
  const view = render(
    <MemoryRouter>
      <CompareTable
        rows={ROWS}
        catalogueById={CATALOGUE}
        onOpenTrace={onOpenTrace}
        openAlgorithmId={overrides.openAlgorithmId ?? null}
      />
    </MemoryRouter>,
  );
  return { onOpenTrace, ...view };
}

describe('CompareTable', () => {
  it('renders one row per result, the mono algorithm id as one button per row', () => {
    renderTable();

    const button = screen.getByRole('button', { name: 'levenshtein' });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Levenshtein distance')).toBeInTheDocument();
  });

  it('opens that row’s trace when its algorithm button is activated, keeping the table in place', async () => {
    const user = userEvent.setup();
    const { onOpenTrace } = renderTable();

    await user.click(screen.getByRole('button', { name: 'levenshtein' }));

    expect(onOpenTrace).toHaveBeenCalledWith('levenshtein');
    expect(onOpenTrace).toHaveBeenCalledTimes(1);
    // The table itself never unmounts as a side effect of opening a trace.
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('marks the currently-open row with aria-current, and no other row', () => {
    renderTable({ openAlgorithmId: 'tfidf-cosine' });

    const openRow = screen.getByRole('row', { name: /tfidf-cosine/i });
    expect(openRow).toHaveAttribute('aria-current', 'true');

    const otherRow = screen.getByRole('row', { name: /^levenshtein/i });
    expect(otherRow).not.toHaveAttribute('aria-current');
  });

  it('marks no row as current when no trace is open', () => {
    renderTable({ openAlgorithmId: null });

    for (const row of screen.getAllByRole('row')) {
      expect(row).not.toHaveAttribute('aria-current');
    }
  });

  it('opens the row’s trace from a click on a cell far from the algorithm button, not only the button itself', async () => {
    const user = userEvent.setup();
    const { onOpenTrace } = renderTable();

    const row = screen.getByRole('row', { name: /^levenshtein/i });
    // The raw-value cell — nowhere near the algorithm button — still opens
    // this row's trace: the hit area is the row, not the algorithm cell the
    // button's own box happens to sit in.
    await user.click(within(row).getByText('12'));

    expect(onOpenTrace).toHaveBeenCalledWith('levenshtein');
    expect(onOpenTrace).toHaveBeenCalledTimes(1);
  });

  it('exposes exactly one accessible button per row, the row’s single trace trigger', () => {
    renderTable();

    const [headerRow, ...resultRows] = screen.getAllByRole('row');
    expect(within(headerRow).queryAllByRole('button')).toHaveLength(0);
    for (const row of resultRows) {
      expect(within(row).getAllByRole('button')).toHaveLength(1);
    }
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
