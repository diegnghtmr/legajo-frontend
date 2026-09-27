/**
 * Builds a `DpMatrixTrace`-shaped payload (`GET /similarity/{algorithmId}/
 * trace` for `levenshtein`/`needleman-wunsch`) at any real matrix size,
 * without shipping the real response's own full row/column label arrays —
 * the skeleton-vs-loaded box this guard checks depends only on the
 * matrix's own dimensions and the meta row/legend/formula around it, never
 * on which specific words label which row, so a small, cycled sample of
 * real tokens (`rowTokenSample`/`columnTokenSample` below) reproduces the
 * exact same shape a much larger captured fixture would.
 *
 * Follows the backend's own contract exactly (`MatrixCell`/
 * `DpMatrixTrace`): `rowLabels`/`columnLabels` carry `rowTokenCount`/
 * `columnTokenCount` tokens ONLY, one shorter than the matrix's own
 * `rowTokenCount + 1` rows and `columnTokenCount + 1` columns — row/column
 * 0 is always the empty prefix, and this never emits an entry for it.
 */

export type DpOperationKind =
  'MATCH' | 'SUBSTITUTION' | 'INSERTION' | 'DELETION' | 'MISMATCH' | 'GAP';

export interface DpTraceCell {
  row: number;
  col: number;
}

export interface DpTraceStep {
  from: DpTraceCell;
  to: DpTraceCell;
  operation: DpOperationKind;
}

export interface DpTraceBuilderOptions {
  algorithmId: 'levenshtein' | 'needleman-wunsch';
  /** The real d01/d02 token count for this axis (106 rows, 83 columns for
   * the reference corpus's own smallest real DP pair) — callers pass the
   * real number; this never derives it from the (deliberately short)
   * sample below. */
  rowTokenCount: number;
  columnTokenCount: number;
  /** A short slice of the real d01/d02 tokens (never the full ~100-entry
   * list), cycled to fill `rowTokenCount`/`columnTokenCount` — enough to
   * keep this fixture's own row/column headers real, readable text
   * instead of a placeholder like "token-42". */
  rowTokenSample?: readonly string[];
  columnTokenSample?: readonly string[];
}

const DEFAULT_ROW_TOKEN_SAMPLE = [
  'since',
  'artificial',
  'intelligence',
  'ai',
  'finding',
  'way',
  'areas',
  'everyday',
  'life',
  'improving',
];

const DEFAULT_COLUMN_TOKEN_SAMPLE = [
  'applications',
  'artificial',
  'intelligence',
  'education',
  'aied',
  'emerging',
  'new',
  'researchers',
  'practitioners',
  'alike',
];

function cycledTokens(count: number, sample: readonly string[]): string[] {
  return Array.from({ length: count }, (_unused, index) => sample[index % sample.length]);
}

/**
 * A monotonic path from the matrix's own origin (0, 0) to its final cell
 * (`rows - 1`, `cols - 1`): diagonal while both axes still have distance
 * left, then straight along whichever axis has excess — a real DP
 * backtrack's own shape (`SUBSTITUTION`/`MISMATCH` steps for as long as
 * both strings still have unconsumed tokens, then `DELETION`/`INSERTION`/
 * `GAP` steps for the longer string's own remainder), never the literal
 * real path (which depends on the two real documents' own content and is
 * exactly what this builder avoids needing to ship).
 */
function buildAscendingPath(rows: number, cols: number): DpTraceCell[] {
  const path: DpTraceCell[] = [{ row: 0, col: 0 }];
  let row = 0;
  let col = 0;
  while (row < rows - 1 || col < cols - 1) {
    if (row < rows - 1 && col < cols - 1) {
      row += 1;
      col += 1;
    } else if (row < rows - 1) {
      row += 1;
    } else {
      col += 1;
    }
    path.push({ row, col });
  }
  return path;
}

export function buildDpTrace({
  algorithmId,
  rowTokenCount,
  columnTokenCount,
  rowTokenSample = DEFAULT_ROW_TOKEN_SAMPLE,
  columnTokenSample = DEFAULT_COLUMN_TOKEN_SAMPLE,
}: DpTraceBuilderOptions) {
  const rowLabels = cycledTokens(rowTokenCount, rowTokenSample);
  const columnLabels = cycledTokens(columnTokenCount, columnTokenSample);
  const rows = rowTokenCount + 1;
  const cols = columnTokenCount + 1;
  // Plausible DP-shaped values (each cell within a small distance of its
  // own row/column index, matching a real edit-distance/alignment
  // matrix's own gently-increasing gradient) — never claimed as the real
  // scores, only as valid numbers the heat-map/CSV export can render.
  const matrix = Array.from({ length: rows }, (_unused, row) =>
    Array.from({ length: cols }, (_unused2, col) => Math.abs(row - col)),
  );

  const diagonalOp: DpOperationKind = algorithmId === 'levenshtein' ? 'SUBSTITUTION' : 'MISMATCH';
  const rowOnlyOp: DpOperationKind = algorithmId === 'levenshtein' ? 'DELETION' : 'GAP';
  const colOnlyOp: DpOperationKind = algorithmId === 'levenshtein' ? 'INSERTION' : 'GAP';

  const ascending = buildAscendingPath(rows, cols);
  const operations: DpTraceStep[] = [];
  for (let index = 1; index < ascending.length; index += 1) {
    const from = ascending[index - 1];
    const to = ascending[index];
    const operation =
      to.row === from.row + 1 && to.col === from.col + 1
        ? diagonalOp
        : to.row === from.row + 1
          ? rowOnlyOp
          : colOnlyOp;
    operations.push({ from, to, operation });
  }

  // The real trace orders both arrays from the matrix's own final cell
  // back to its origin — mirrored here only for consistency; nothing this
  // guard checks depends on the order.
  const optimalPath = [...ascending].reverse();
  operations.reverse();

  return { algorithmId, rowLabels, columnLabels, matrix, optimalPath, operations };
}
