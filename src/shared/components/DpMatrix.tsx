import { useEffect, useRef } from 'react';

import { cn } from '../lib/cn';
import { toCsv } from '../lib/csv';

export interface DpMatrixCell {
  row: number;
  col: number;
}

export interface DpMatrixProps {
  /** One label per matrix row, same length as `matrix` (index 0 is the empty-prefix row). */
  rowLabels: readonly string[];
  /** One label per matrix column, same length as each row of `matrix`. */
  columnLabels: readonly string[];
  /** The complete DP matrix — never a windowed or truncated subset (PRD HU-1.2). */
  matrix: readonly (readonly number[])[];
  optimalPath: readonly DpMatrixCell[];
  /** Accessible caption for the table (e.g. "Levenshtein matrix"). */
  ariaLabel: string;
  downloadLabel: string;
  downloadFileName: string;
  /** Accessible suffix appended to a path cell's own value, e.g. "Optimal path cell". */
  pathCellLabel: string;
}

/**
 * Proportional grayscale bucket over the matrix's own [min, max] range
 * (DESIGN.md §6 item 3 / §7.5): `matrix-low`/`matrix-mid-low`/`matrix-mid`
 * use `ink` text (contrast ≥ 6.4:1), `matrix-high` uses `paper` text (17:1).
 */
function heatClassName(value: number, min: number, max: number): string {
  const range = max - min;
  const t = range === 0 ? 0 : (value - min) / range;

  if (t >= 0.75) {
    return 'bg-matrix-high text-paper';
  }
  if (t >= 0.5) {
    return 'bg-matrix-mid text-ink';
  }
  if (t >= 0.25) {
    return 'bg-matrix-mid-low text-ink';
  }
  return 'bg-matrix-low text-ink';
}

function pathKey(row: number, col: number): string {
  return `${row}-${col}`;
}

/**
 * Complete DP trace matrix (Levenshtein / Needleman–Wunsch), rendered in a
 * scrollable viewport (DESIGN.md §6 item 3, §9.3 `DpMatrix`). Lives in
 * `shared/` per DESIGN.md §9.3's own component inventory and AGENTS.md's
 * repository map, which both list `DpMatrix` as a shared component — not
 * re-derived from the "second importer" scope-rule heuristic used for
 * feature-local components, since the documents already fix its location.
 * No virtualization library: the reference corpus's abstracts are short
 * (at most a few hundred tokens), so a plain scrollable `<table>` renders
 * every cell directly without the indirection of a windowing dependency
 * that is not in the fixed stack.
 */
export function DpMatrix({
  rowLabels,
  columnLabels,
  matrix,
  optimalPath,
  ariaLabel,
  downloadLabel,
  downloadFileName,
  pathCellLabel,
}: DpMatrixProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const pathSet = new Set(optimalPath.map((cell) => pathKey(cell.row, cell.col)));
  const flatValues = matrix.flat();
  const min = Math.min(...flatValues);
  const max = Math.max(...flatValues);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const firstPathCell = container.querySelector('[data-optimal-path="true"]');
    firstPathCell?.scrollIntoView?.({ block: 'center', inline: 'center' });
  }, [matrix, optimalPath]);

  function downloadCsv() {
    const csv = toCsv(
      ['', ...columnLabels],
      rowLabels.map((label, row) => [label, ...matrix[row]]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="max-h-[420px] max-w-full overflow-auto rounded-md border border-hairline"
      >
        <table className="border-collapse text-center">
          <caption className="sr-only">{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 left-0 z-20 bg-paper-sunken p-1" />
              {columnLabels.map((label, col) => (
                <th
                  key={col}
                  scope="col"
                  className="sticky top-0 z-10 min-w-8 bg-paper-sunken p-1 font-mono text-mono text-ink-secondary"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((rowValues, row) => (
              <tr key={row}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-8 bg-paper-sunken p-1 font-mono text-mono text-ink-secondary"
                >
                  {rowLabels[row]}
                </th>
                {rowValues.map((value, col) => {
                  const isPath = pathSet.has(pathKey(row, col));
                  return (
                    <td
                      key={col}
                      data-optimal-path={isPath ? 'true' : undefined}
                      aria-label={isPath ? `${value}. ${pathCellLabel}` : undefined}
                      className={cn(
                        'min-w-8 p-1 font-mono text-mono',
                        heatClassName(value, min, max),
                        isPath && 'ring-2 ring-inset ring-path',
                      )}
                    >
                      <span>{value}</span>
                      {isPath && (
                        <span aria-hidden="true" className="ml-1 text-[10px]">
                          ●
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={downloadCsv}
        className="w-fit rounded-btn border border-hairline-strong bg-paper-raised px-3 py-1.5 text-body text-ink hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {downloadLabel}
      </button>
    </div>
  );
}
