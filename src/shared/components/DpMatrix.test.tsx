import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DpMatrix, type DpMatrixHandle } from './DpMatrix';

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

  it('makes the scrollable matrix viewport itself keyboard-focusable (WCAG 2.1.1 scrollable-region-focusable)', () => {
    // The mocked e2e fixtures (4x4) never overflow max-h-[420px], so this
    // never surfaced there; the full-stack e2e suite hit it for real
    // against a real, longer document pair, where the container genuinely
    // scrolls and axe's scrollable-region-focusable rule flags a
    // non-focusable overflow container as unreachable by keyboard.
    renderMatrix();

    const region = screen.getByRole('region', { name: 'Levenshtein matrix' });
    expect(region).toHaveAttribute('tabindex', '0');
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

  it('does not submit a surrounding form when the CSV button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    render(
      <form onSubmit={onSubmit}>
        <DpMatrix
          rowLabels={ROW_LABELS}
          columnLabels={COLUMN_LABELS}
          matrix={MATRIX}
          optimalPath={OPTIMAL_PATH}
          ariaLabel="Levenshtein matrix"
          downloadLabel="Download CSV"
          downloadFileName="levenshtein-matrix.csv"
          pathCellLabel="Optimal path cell"
        />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(onSubmit).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  describe('auto-scroll to the optimal path', () => {
    // jsdom implements neither `Element.scrollTo` nor a layout engine (every
    // `getBoundingClientRect` is all zeros) — these tests install plain
    // fakes for both, and remove them again afterward.
    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
      Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect');
    });

    it("scrolls only the matrix's own viewport (never scrollIntoView, which would also scroll every scrollable ancestor) to the final optimal-path cell — the published score, not the path's first cell", () => {
      const scrollTo = vi.fn();
      HTMLElement.prototype.scrollTo = scrollTo;
      const getBoundingClientRect = vi
        .fn()
        .mockReturnValue({ left: 0, top: 0, width: 0, height: 0 });
      HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;

      renderMatrix();

      const region = screen.getByRole('region', { name: 'Levenshtein matrix' });
      const pathCells = screen.getAllByLabelText('Optimal path cell', { exact: false });
      const finalCell = pathCells[pathCells.length - 1];

      // The region itself is scrolled — its own `scrollTo`, never
      // `scrollIntoView` on the cell.
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo.mock.instances[0]).toBe(region);
      // The position is computed from the FINAL path cell's own geometry…
      expect(getBoundingClientRect.mock.instances).toContain(finalCell);
      // …never the path's first (origin) cell.
      expect(getBoundingClientRect.mock.instances).not.toContain(pathCells[0]);
    });

    it('re-scrolls to the new final cell when the matrix/path change (a different pair or algorithm)', () => {
      const scrollTo = vi.fn();
      HTMLElement.prototype.scrollTo = scrollTo;
      HTMLElement.prototype.getBoundingClientRect = vi
        .fn()
        .mockReturnValue({ left: 0, top: 0, width: 0, height: 0 });

      const { rerender } = renderMatrix();
      expect(scrollTo).toHaveBeenCalledTimes(1);

      const nextPath = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 1 },
      ];
      rerender(
        <DpMatrix
          rowLabels={ROW_LABELS}
          columnLabels={COLUMN_LABELS}
          matrix={MATRIX}
          optimalPath={nextPath}
          ariaLabel="Levenshtein matrix"
          downloadLabel="Download CSV"
          downloadFileName="levenshtein-matrix.csv"
          pathCellLabel="Optimal path cell"
        />,
      );

      expect(scrollTo).toHaveBeenCalledTimes(2);
    });

    it('gracefully skips the font-load re-scroll when `document.fonts` is unavailable (this project never assumes it in a test environment)', () => {
      const scrollTo = vi.fn();
      HTMLElement.prototype.scrollTo = scrollTo;
      HTMLElement.prototype.getBoundingClientRect = vi
        .fn()
        .mockReturnValue({ left: 0, top: 0, width: 0, height: 0 });

      expect(() => renderMatrix()).not.toThrow();
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });
  });

  describe('an embedding caller that hides this own download button (the panel places it in a pinned footer instead)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('renders no download button of its own when showDownloadButton is false', () => {
      render(
        <DpMatrix
          rowLabels={ROW_LABELS}
          columnLabels={COLUMN_LABELS}
          matrix={MATRIX}
          optimalPath={OPTIMAL_PATH}
          ariaLabel="Levenshtein matrix"
          downloadLabel="Download CSV"
          downloadFileName="levenshtein-matrix.csv"
          pathCellLabel="Optimal path cell"
          showDownloadButton={false}
        />,
      );

      expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
    });

    it('still downloads the same CSV when triggered imperatively through a forwarded ref', async () => {
      let capturedBlob: Blob | undefined;
      const createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
      const ref = createRef<DpMatrixHandle>();

      render(
        <DpMatrix
          ref={ref}
          rowLabels={ROW_LABELS}
          columnLabels={COLUMN_LABELS}
          matrix={MATRIX}
          optimalPath={OPTIMAL_PATH}
          ariaLabel="Levenshtein matrix"
          downloadLabel="Download CSV"
          downloadFileName="levenshtein-matrix.csv"
          pathCellLabel="Optimal path cell"
          showDownloadButton={false}
        />,
      );

      ref.current?.downloadCsv();

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const text = await capturedBlob?.text();
      expect(text?.split('\r\n')).toHaveLength(MATRIX.length + 1);
    });
  });

  describe('CSV download anchor lifecycle', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('attaches the anchor to the document before clicking it, and revokes the object URL only once timers advance', () => {
      vi.useFakeTimers();
      const createObjectURL = vi.fn(() => 'blob:mock-url');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

      let anchorInDocumentAtClick = false;
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
        anchorInDocumentAtClick = document.body.contains(this);
        return originalClick.call(this);
      };

      try {
        renderMatrix();
        fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

        expect(anchorInDocumentAtClick).toBe(true);
        expect(revokeObjectURL).not.toHaveBeenCalled();

        vi.advanceTimersByTime(0);

        expect(revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      } finally {
        HTMLAnchorElement.prototype.click = originalClick;
      }
    });
  });
});
