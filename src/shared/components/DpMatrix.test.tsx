import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DpMatrix } from './DpMatrix';

const ROW_LABELS = ['', 'k', 'i', 't'];
const COLUMN_LABELS = ['', 's', 'i', 't'];
// 4x4 Levenshtein-shaped matrix (kit vs sit): row/col 0 are the empty-prefix border.
const MATRIX = [
  [0, 1, 2, 3],
  [1, 1, 2, 3],
  [2, 2, 1, 2],
  [3, 3, 2, 1],
];
const OPTIMAL_PATH = [
  { row: 0, col: 0 },
  { row: 1, col: 1 },
  { row: 2, col: 2 },
  { row: 3, col: 3 },
];

function renderMatrix() {
  return render(
    <DpMatrix
      rowLabels={ROW_LABELS}
      columnLabels={COLUMN_LABELS}
      matrix={MATRIX}
      optimalPath={OPTIMAL_PATH}
      ariaLabel="Levenshtein matrix"
      downloadLabel="Download CSV"
      downloadFileName="levenshtein-matrix.csv"
      pathCellLabel="Optimal path cell"
    />,
  );
}

describe('DpMatrix', () => {
  it('renders every cell of the matrix (rows x cols), never a truncated subset', () => {
    renderMatrix();

    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(MATRIX.length * MATRIX[0].length);
    for (const row of cells) {
      expect(row.textContent).not.toBe('');
    }
  });

  it('marks exactly the optimal-path cells, both visually and with accessible text', () => {
    renderMatrix();

    const markedCells = screen.getAllByLabelText('Optimal path cell', { exact: false });
    expect(markedCells).toHaveLength(OPTIMAL_PATH.length);

    for (const marked of markedCells) {
      expect(marked).toHaveAttribute('data-optimal-path', 'true');
    }

    const allCells = screen.getAllByRole('cell');
    const unmarkedCount = allCells.filter(
      (cell) => cell.getAttribute('data-optimal-path') !== 'true',
    ).length;
    expect(unmarkedCount).toBe(MATRIX.length * MATRIX[0].length - OPTIMAL_PATH.length);
  });

  it('gives the matrix minimum and maximum values visibly distinct heat classes', () => {
    renderMatrix();

    const cells = screen.getAllByRole('cell');
    // Matrix minimum (0) is at [0][0]; maximum (3) is at [2][3] and [3][1]/[3][2] etc.
    const valueOf = (cell: HTMLElement) => cell.querySelector('span')?.textContent;
    const minCell = cells.find((cell) => valueOf(cell) === '0');
    const maxCell = cells.find((cell) => valueOf(cell) === '3');
    expect(minCell?.className).toContain('matrix-low');
    expect(maxCell?.className).toContain('matrix-high');
    expect(minCell?.className).not.toBe(maxCell?.className);
  });

  it('renders row and column token labels', () => {
    renderMatrix();

    expect(screen.getByRole('columnheader', { name: 's' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'k' })).toBeInTheDocument();
  });

  it('downloads a CSV containing every cell value, in row order, when the button is clicked', async () => {
    const user = userEvent.setup();
    let capturedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    renderMatrix();

    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedBlob).toBeInstanceOf(Blob);
    const text = await capturedBlob?.text();
    const lines = text?.split('\r\n') ?? [];

    // Header row (blank corner + column labels) + one row per matrix row.
    expect(lines).toHaveLength(MATRIX.length + 1);
    for (let row = 0; row < MATRIX.length; row += 1) {
      const cells = lines[row + 1].split(',');
      expect(cells[0]).toBe(ROW_LABELS[row]);
      for (let col = 0; col < MATRIX[row].length; col += 1) {
        expect(cells[col + 1]).toBe(String(MATRIX[row][col]));
      }
    }

    vi.unstubAllGlobals();
  });
});
