import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { cn } from '../lib/cn';
import { toCsv } from '../lib/csv';
import { Button } from './ui/button';

export interface DpMatrixCell {
  row: number;
  col: number;
}

export interface DpMatrixProps {
  /** The compared strings' own tokens ONLY — one entry per real row token,
   * never an entry for the empty-prefix border (the backend's own
   * `DpMatrixTrace` contract): exactly one entry shorter than `matrix`
   * itself. Matrix row 0 is always the empty prefix; row `i >= 1` is
   * `rowLabels[i - 1]`. */
  rowLabels: readonly string[];
  /** The same contract as `rowLabels`, for columns: one entry shorter than
   * each row of `matrix`. Matrix column 0 is always the empty prefix;
   * column `i >= 1` is `columnLabels[i - 1]`. */
  columnLabels: readonly string[];
  /** The complete DP matrix — never a windowed or truncated subset. */
  matrix: readonly (readonly number[])[];
  optimalPath: readonly DpMatrixCell[];
  /** Accessible caption for the table (e.g. "Levenshtein matrix"). */
  ariaLabel: string;
  downloadLabel: string;
  downloadFileName: string;
  /** Accessible suffix appended to a path cell's own value, e.g. "Optimal path cell". */
  pathCellLabel: string;
  /** Accessible name for the sticky top-left corner cell, which otherwise
   * renders with no text at all (`empty-table-header`): it sits at the
   * intersection of both strings' own zero-length prefix, so a short,
   * axis-accurate label (e.g. "Prefix") reads correctly regardless of which
   * two documents are being compared. */
  cornerLabel: string;
  /** Template for the sr-only fallback given to the empty-prefix header at
   * row/column 0 — the zero-length prefix every DP alignment starts from,
   * which otherwise renders with no accessible text at all
   * (`empty-table-header`). Must contain the literal placeholder
   * `{{index}}`, e.g. "Prefix of length {{index}}". */
  emptyPrefixLabelTemplate: string;
  /** Renders this component's own "Download CSV" button. Defaults to `true`
   * (the standalone full trace view's own layout). The docked/overlay trace
   * panel sets this to `false` and instead pins an equivalent action in its
   * own footer, triggered through the forwarded `DpMatrixHandle`. */
  showDownloadButton?: boolean;
}

export interface DpMatrixHandle {
  /** Triggers the exact same CSV download the internal button fires,
   * regardless of whether that button is rendered (`showDownloadButton`). */
  downloadCsv: () => void;
}

/**
 * Proportional grayscale bucket over the matrix's own [min, max] range:
 * `matrix-low`/`matrix-mid-low`/`matrix-mid`
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

/** Literal `{{index}}` replacement — deliberately not a full templating
 * engine: the one caller (`DpTracePanel`) only ever needs this single
 * placeholder, and this stays i18n-agnostic (the translated template
 * string is already resolved by the caller). */
function formatEmptyPrefixLabel(template: string, index: number): string {
  return template.replace('{{index}}', String(index));
}

/**
 * The real token at matrix row/column index `i`: `undefined` at index 0
 * (the empty-prefix border, which every alignment starts from and which
 * `labels` itself never carries an entry for), `labels[i - 1]` at every
 * later index. Both `DpMatrix`'s own header rendering and its CSV export
 * read `rowLabels`/`columnLabels` through this one function, so the two
 * can never drift into disagreeing about which matrix index maps to which
 * label.
 */
function tokenAt(labels: readonly string[], index: number): string | undefined {
  return index === 0 ? undefined : labels[index - 1];
}

/**
 * Complete DP trace matrix (Levenshtein / Needleman–Wunsch), rendered in a
 * scrollable viewport. Lives in
 * `shared/` because it is used by more than one feature — not
 * re-derived from the "second importer" scope-rule heuristic used for
 * feature-local components, since its location is already fixed.
 * No virtualization library: the reference corpus's abstracts are short
 * (at most a few hundred tokens), so a plain scrollable `<table>` renders
 * every cell directly without the indirection of a windowing dependency
 * that is not in the fixed stack.
 */
export const DpMatrix = forwardRef<DpMatrixHandle, DpMatrixProps>(function DpMatrix(
  {
    rowLabels,
    columnLabels,
    matrix,
    optimalPath,
    ariaLabel,
    downloadLabel,
    downloadFileName,
    pathCellLabel,
    cornerLabel,
    emptyPrefixLabelTemplate,
    showDownloadButton = true,
  }: DpMatrixProps,
  forwardedRef,
) {
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

    // `scrollIntoView` scrolls every scrollable ANCESTOR too, not only this
    // container — on the standalone full-screen trace view, a large real
    // matrix pushed the page's own scroll position down, leaving the
    // view's own heading and pair above the viewport on arrival. Computing
    // the target scroll position from `getBoundingClientRect` deltas and
    // setting THIS container's own `scrollTo` directly touches only this
    // one scroll container, regardless of what (if anything) else on the
    // page also scrolls.
    function scrollToFinalPathCell() {
      // The optimal path always terminates at the matrix's own bottom-right
      // cell (the published edit distance / alignment score) — the LAST
      // `[data-optimal-path]` cell in this row-major-rendered table, never
      // the first (the path's origin near (0,0), which is what an earlier
      // version anchored on instead, leaving the actual score cell of a
      // large real matrix off-screen).
      const pathCells = container!.querySelectorAll('[data-optimal-path="true"]');
      const finalPathCell = pathCells[pathCells.length - 1];
      if (!finalPathCell) {
        return;
      }
      const containerRect = container!.getBoundingClientRect();
      const cellRect = finalPathCell.getBoundingClientRect();
      const left =
        container!.scrollLeft +
        (cellRect.left + cellRect.width / 2) -
        (containerRect.left + containerRect.width / 2);
      const top =
        container!.scrollTop +
        (cellRect.top + cellRect.height / 2) -
        (containerRect.top + containerRect.height / 2);
      // Optionally-chained: jsdom (this project's unit-test environment)
      // implements neither `scrollIntoView` (the old call, also
      // optionally-chained above) nor `Element.scrollTo`.
      container!.scrollTo?.({ left, top });
    }

    scrollToFinalPathCell();
    // A webfont finishing its load after this initial pass can still shift
    // column/row widths enough to leave the just-computed offset short of
    // the final cell; re-running once fonts have actually settled keeps
    // that from leaving a stale scroll position behind. `document.fonts` is
    // absent in some test environments (jsdom), so this stays optional.
    let cancelled = false;
    void document.fonts?.ready?.then(() => {
      if (!cancelled) {
        scrollToFinalPathCell();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [matrix, optimalPath]);

  function downloadCsv() {
    // One header cell per data column (the empty prefix at column 0, then
    // `columnLabels`), never `columnLabels` alone: that left this CSV's own
    // header row one column short of every data row's own `[label,
    // ...matrix[row]]` — which itself always has `columnLabels.length + 1`
    // values, matching the matrix's real width.
    const columnHeaderRow = [
      '',
      ...matrix[0].map((_unused, col) => tokenAt(columnLabels, col) ?? ''),
    ];
    const dataRows = matrix.map((rowValues, row) => [tokenAt(rowLabels, row) ?? '', ...rowValues]);
    const csv = toCsv(columnHeaderRow, dataRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadFileName;
    // Some browsers only start the download if the anchor is actually in the
    // document when `click()` fires. Revoking the object URL must wait for
    // the next tick: revoking it synchronously (right after `click()`) can
    // race the download that `click()` just kicked off and cancel it.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  useImperativeHandle(forwardedRef, () => ({ downloadCsv }));

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="max-h-[420px] max-w-full overflow-auto rounded-md border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <table className="border-collapse text-center">
          <caption className="sr-only">{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 left-0 z-20 bg-paper-sunken p-1">
                <span className="sr-only">{cornerLabel}</span>
              </th>
              {matrix[0].map((_unused, col) => (
                <th
                  key={col}
                  scope="col"
                  className="sticky top-0 z-10 min-w-8 bg-paper-sunken p-1 font-mono text-mono text-ink-secondary"
                >
                  {col === 0 ? (
                    <span className="sr-only">
                      {formatEmptyPrefixLabel(emptyPrefixLabelTemplate, col)}
                    </span>
                  ) : (
                    tokenAt(columnLabels, col)
                  )}
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
                  {row === 0 ? (
                    <span className="sr-only">
                      {formatEmptyPrefixLabel(emptyPrefixLabelTemplate, row)}
                    </span>
                  ) : (
                    tokenAt(rowLabels, row)
                  )}
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
      {showDownloadButton && (
        <Button type="button" variant="secondary" onClick={downloadCsv} className="w-fit">
          {downloadLabel}
        </Button>
      )}
    </div>
  );
});
