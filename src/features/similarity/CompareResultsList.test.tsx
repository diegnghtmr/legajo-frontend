import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { CompareResultsList } from './CompareResultsList';
import { restoreTraceTrigger } from './traceFocusReturn';

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

function renderList(
  overrides: Partial<{
    onOpenTrace: (algorithmId: string) => void;
    openAlgorithmId: string | null;
  }> = {},
) {
  const onOpenTrace = overrides.onOpenTrace ?? vi.fn();
  const view = render(
    <MemoryRouter>
      <CompareResultsList
        rows={ROWS}
        catalogueById={CATALOGUE}
        onOpenTrace={onOpenTrace}
        openAlgorithmId={overrides.openAlgorithmId ?? null}
      />
    </MemoryRouter>,
  );
  return { onOpenTrace, ...view };
}

/**
 * The below-`lg` results list: each row is a single ≥44px button — family
 * dot, mono id, score, chevron on one line, a quiet second line for the
 * raw value and the time with its cached marker — that opens the row's
 * own trace, exactly like `CompareTable`'s row does at `lg`+.
 */
describe('CompareResultsList', () => {
  it('renders one row per result, each at least 44px tall, as a single button', () => {
    renderList();

    const button = screen.getByRole('button', { name: 'levenshtein' });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('min-h-11');
  });

  it("shows the family dot (never color alone — the label stays in the accessible tree) and the mono score on the row's first line", () => {
    renderList();

    const row = screen.getByRole('button', { name: 'levenshtein' });
    expect(within(row).getByText('0.500')).toBeInTheDocument();
    // The family label is present for assistive technology, just not
    // painted — `FamilyStatus`'s own `hideLabel` contract.
    expect(within(row).getByText('Clásico')).toBeInTheDocument();
  });

  it('shows the raw value and the computed time on a quiet second line', () => {
    renderList();

    const row = screen.getByRole('button', { name: 'levenshtein' });
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(within(row).getByText('1.234.567')).toBeInTheDocument();
  });

  it('shows the cached marker only for a cached row', () => {
    renderList();

    const cachedRow = screen.getByRole('button', { name: 'embedding-api' });
    expect(within(cachedRow).getByText('en caché')).toBeInTheDocument();

    const nonCachedRow = screen.getByRole('button', { name: 'levenshtein' });
    expect(within(nonCachedRow).queryByText('en caché')).not.toBeInTheDocument();
  });

  it('never wraps the cached marker onto a second line', () => {
    renderList();

    const cachedRow = screen.getByRole('button', { name: 'embedding-api' });
    expect(within(cachedRow).getByText('en caché').className).toContain('whitespace-nowrap');
  });

  it('shows a dash and accessible text for a null raw value in the degenerate case', () => {
    renderList();

    const row = screen.getByRole('button', { name: 'tfidf-cosine' });
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(within(row).getByText('No aplica en este caso degenerado')).toBeInTheDocument();
  });

  it('opens the row’s trace when activated, and marks the currently-open row with aria-current', async () => {
    const user = userEvent.setup();
    const { onOpenTrace } = renderList({ openAlgorithmId: 'tfidf-cosine' });

    const openRow = screen.getByRole('button', { name: 'tfidf-cosine' });
    expect(openRow).toHaveAttribute('aria-current', 'true');

    const otherRow = screen.getByRole('button', { name: 'levenshtein' });
    expect(otherRow).not.toHaveAttribute('aria-current');

    await user.click(otherRow);
    expect(onOpenTrace).toHaveBeenCalledWith('levenshtein');
  });

  it('remembers the row’s own button as the trace trigger, for focus return after the trace sheet closes', async () => {
    const user = userEvent.setup();
    renderList();

    const row = screen.getByRole('button', { name: 'levenshtein' });
    await user.click(row);
    restoreTraceTrigger();

    expect(row).toHaveFocus();
  });
});
