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
  it('enters each cell staggered along the anti-diagonal, capped so a large matrix does not wait on its corner', () => {
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    rows.forEach((row, rowIndex) => {
      within(row)
        .getAllByRole('cell')
        .forEach((cellElement, columnIndex) => {
          expect(cellElement).toHaveClass('enter-rise');
          expect(cellElement.style.getPropertyValue('--i')).toBe(String(rowIndex + columnIndex));
        });
    });
  });

  it('caps the stagger index at 12', () => {
    const ids = Array.from({ length: 9 }, (_unused, index) => `doc-${index}`);
    const cells = ids.map(() => ids.map(() => cell(0.5)));
    render(<MatrixTable documentIds={ids} titleById={new Map()} cells={cells} />);

    const lastRow = screen.getAllByRole('row').at(-1)!;
    const lastCell = within(lastRow).getAllByRole('cell').at(-1)!;
    expect(lastCell.style.getPropertyValue('--i')).toBe('12');
  });

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

  it('gives the sticky top-left corner header a non-empty accessible name instead of leaving it blank (empty-table-header)', () => {
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const cornerHeader = screen.getByRole('columnheader', { name: 'Documento' });
    expect(cornerHeader.textContent?.trim()).toBe('Documento');
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

  it('scrolls inside exactly one bounded container, with no nested overflow wrapper between it and the table', () => {
    // A sticky header row and a sticky first column only stick relative to
    // the nearest ancestor that actually scrolls. Two nested `overflow`
    // divs (this component's own container plus the Table primitive's own
    // wrapper) make that ambiguous and silently unstick them, so the
    // table's direct parent must be this component's single scroll region.
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const region = screen.getByRole('region', { name: /Matriz de similitud/i });
    const table = screen.getByRole('table');
    expect(table.parentElement).toBe(region);
    expect(region.className).toContain('overflow-auto');
    expect(region.className).toContain('max-h-');
  });

  it('makes the scrollable matrix viewport itself keyboard-focusable (WCAG 2.1.1 scrollable-region-focusable)', () => {
    render(
      <MatrixTable documentIds={DOCUMENT_IDS} titleById={TITLE_BY_ID} cells={SYMMETRIC_CELLS} />,
    );

    const region = screen.getByRole('region', { name: /Matriz de similitud/i });
    expect(region).toHaveAttribute('tabindex', '0');
  });
});
