import { render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { DpMatrixTrace } from '../../../infrastructure/schemas/similarity';
import type { DpMatrixHandle } from '../../../shared/components/DpMatrix';
import { DpTracePanel } from './DpTracePanel';

const LEVENSHTEIN_TRACE: DpMatrixTrace = {
  algorithmId: 'levenshtein',
  rowLabels: ['', 'k', 'i', 't'],
  columnLabels: ['', 's', 'i', 't'],
  matrix: [
    [0, 1, 2, 3],
    [1, 1, 2, 3],
    [2, 2, 1, 2],
    [3, 3, 2, 1],
  ],
  optimalPath: [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
    { row: 3, col: 3 },
  ],
  operations: [
    { from: { row: 0, col: 0 }, to: { row: 1, col: 1 }, operation: 'SUBSTITUTION' },
    { from: { row: 1, col: 1 }, to: { row: 2, col: 2 }, operation: 'MATCH' },
    { from: { row: 2, col: 2 }, to: { row: 3, col: 3 }, operation: 'MATCH' },
  ],
};

const NW_TRACE: DpMatrixTrace = {
  ...LEVENSHTEIN_TRACE,
  algorithmId: 'needleman-wunsch',
  operations: [
    { from: { row: 0, col: 0 }, to: { row: 1, col: 1 }, operation: 'MISMATCH' },
    { from: { row: 1, col: 1 }, to: { row: 2, col: 2 }, operation: 'MATCH' },
  ],
};

describe('DpTracePanel', () => {
  it('renders every cell of the trace matrix and marks exactly the optimal-path cells', () => {
    render(<DpTracePanel trace={LEVENSHTEIN_TRACE} />);

    const matrixTable = screen.getByRole('table', { name: /matriz completa/i });
    const cells = within(matrixTable).getAllByRole('cell');
    expect(cells).toHaveLength(
      LEVENSHTEIN_TRACE.matrix.length * LEVENSHTEIN_TRACE.matrix[0].length,
    );
    const marked = cells.filter((cell) => cell.getAttribute('data-optimal-path') === 'true');
    expect(marked).toHaveLength(LEVENSHTEIN_TRACE.optimalPath.length);
  });

  it('renders the full operations sequence, one row per step, auditable end to end', () => {
    render(<DpTracePanel trace={LEVENSHTEIN_TRACE} />);

    const table = screen.getByRole('table', { name: /operaciones/i });
    // Header row + one row per operation step.
    expect(within(table).getAllByRole('row')).toHaveLength(LEVENSHTEIN_TRACE.operations.length + 1);
  });

  it("shows Levenshtein's legend: match, substitution, insertion, deletion", () => {
    render(<DpTracePanel trace={LEVENSHTEIN_TRACE} />);

    const legend = screen.getByRole('list', { name: /leyenda/i });
    expect(within(legend).getByText('Coincidencia')).toBeInTheDocument();
    expect(within(legend).getByText('Sustitución')).toBeInTheDocument();
    expect(within(legend).getByText('Inserción')).toBeInTheDocument();
    expect(within(legend).getByText('Eliminación')).toBeInTheDocument();
    expect(within(legend).queryByText('Hueco')).not.toBeInTheDocument();
  });

  it("shows Needleman–Wunsch's different legend: match, mismatch, gap (the legend changes by algorithm)", () => {
    render(<DpTracePanel trace={NW_TRACE} />);

    const legend = screen.getByRole('list', { name: /leyenda/i });
    expect(within(legend).getByText('Coincidencia')).toBeInTheDocument();
    expect(within(legend).getByText('Discrepancia')).toBeInTheDocument();
    expect(within(legend).getByText('Hueco')).toBeInTheDocument();
    expect(within(legend).queryByText('Sustitución')).not.toBeInTheDocument();
    expect(within(legend).queryByText('Inserción')).not.toBeInTheDocument();
  });

  it('offers the CSV download button for the complete matrix', () => {
    render(<DpTracePanel trace={LEVENSHTEIN_TRACE} />);

    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument();
  });

  it('makes the scrollable operations table itself keyboard-focusable (WCAG 2.1.1 scrollable-region-focusable)', () => {
    // Same gap DpMatrix.tsx had (see its own test): the mocked/small fixtures
    // here never overflow max-h-64, so this only surfaced against a real
    // backend response with a longer operations sequence (full-stack e2e).
    render(<DpTracePanel trace={LEVENSHTEIN_TRACE} />);

    const region = screen.getByRole('region', { name: /secuencia de operaciones/i });
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('shows the required meta row (family, optimal path cost) once the caller resolves a family', () => {
    render(<DpTracePanel trace={LEVENSHTEIN_TRACE} family="classic" />);

    expect(screen.getByTestId('dp-trace-family')).toHaveTextContent('Clásico');
    // Bottom-right cell of LEVENSHTEIN_TRACE.matrix (the edit distance itself).
    expect(screen.getByTestId('dp-trace-optimal-path')).toHaveTextContent('1');
  });

  it('renders no meta row while the caller has not resolved a family yet', () => {
    render(<DpTracePanel trace={LEVENSHTEIN_TRACE} />);

    expect(screen.queryByTestId('dp-trace-family')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dp-trace-optimal-path')).not.toBeInTheDocument();
  });

  describe('embedded inside the trace detail panel (its own header carries the meta row and footer)', () => {
    it('hides its own meta row when hideOwnMetaRow is set, even with a resolved family', () => {
      render(<DpTracePanel trace={LEVENSHTEIN_TRACE} family="classic" hideOwnMetaRow />);

      expect(screen.queryByTestId('dp-trace-family')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dp-trace-optimal-path')).not.toBeInTheDocument();
    });

    it('hides its own CSV download button when hideDownloadButton is set', () => {
      render(<DpTracePanel trace={LEVENSHTEIN_TRACE} hideDownloadButton />);

      expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument();
    });

    it('still exposes the CSV download imperatively through a forwarded ref when its own button is hidden', async () => {
      const createObjectURL = vi.fn(() => 'blob:mock-url');
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
      const ref = createRef<DpMatrixHandle>();

      render(<DpTracePanel ref={ref} trace={LEVENSHTEIN_TRACE} hideDownloadButton />);
      ref.current?.downloadCsv();

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });
  });
});
