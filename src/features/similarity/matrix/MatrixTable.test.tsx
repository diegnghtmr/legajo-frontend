import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MatrixTable } from './MatrixTable';

const DOCUMENT_IDS = ['doc-01', 'doc-02', 'doc-03'];

const TITLE_BY_ID = new Map([
  ['doc-01', 'A survey of string similarity'],
  ['doc-02', 'Embeddings for scientific text'],
  ['doc-03', 'Clustering theory refresher'],
]);

function cell(
  normalizedScore: number,
  overrides: Partial<{ cached: boolean; degenerate: boolean }> = {},
) {
  return {
    normalizedScore,
    rawValue: normalizedScore,
    computedNanos: 1000,
    cached: overrides.cached ?? false,
    degenerate: overrides.degenerate ?? false,
  };
}

const SYMMETRIC_CELLS = [
  [cell(1), cell(0.72), cell(0.4)],
  [cell(0.72), cell(1), cell(0.6, { cached: true })],
  [cell(0.4), cell(0.6, { cached: true }), cell(1, { degenerate: true })],
];

describe('MatrixTable', () => {
  it('renders exactly m x m cell values, each with 3 decimals', () => {
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const values = screen.getAllByText(/^\d\.\d{3}$/);
    expect(values).toHaveLength(9);
    expect(screen.getAllByText('1.000')).toHaveLength(3); // the diagonal
  });

  it('renders one mono column header and one mono row header per document id, with its title accessible', () => {
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const columnHeaders = screen.getAllByRole('columnheader');
    for (const id of DOCUMENT_IDS) {
      const columnHeader = columnHeaders.find((header) => header.textContent?.includes(id));
      expect(columnHeader).toBeDefined();
      expect(columnHeader as HTMLElement).toHaveTextContent(TITLE_BY_ID.get(id) ?? '');
    }
  });

  it('marks a cached cell both visibly and accessibly', () => {
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const cachedCells = screen.getAllByText('0.600').map((node) => node.closest('td'));
    expect(cachedCells).toHaveLength(2); // symmetric: (1,2) and (2,1)
    for (const cachedCell of cachedCells) {
      expect(
        within(cachedCell as HTMLElement).getByText('en caché', { exact: false }),
      ).toBeTruthy();
    }
  });

  it('marks a degenerate cell both visibly and accessibly', () => {
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const degenerateCells = screen.getAllByText('1.000').map((node) => node.closest('td'));
    const lastDiagonalCell = degenerateCells[degenerateCells.length - 1] as HTMLElement;
    expect(within(lastDiagonalCell).getByText('Degenerado', { exact: false })).toBeTruthy();
  });

  it('applies the high heat bucket class to the diagonal (always 1.0)', () => {
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const diagonalCell = screen.getAllByText('1.000')[0]?.closest('td');
    expect(diagonalCell?.className).toContain('bg-matrix-high');
  });
});
