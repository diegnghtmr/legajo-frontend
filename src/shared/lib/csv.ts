/**
 * RFC 4180 field escaping: only quote a field that actually needs it (contains
 * the delimiter, a double quote, or a line break), doubling any embedded quote.
 */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Builds a complete CSV document from a header row and data rows, client-side
 * (formatting, not computation — the interface never recomputes a value it
 * did not already receive from the backend). Used by `DpMatrix`'s download
 * button so the exported file always contains every cell, never a windowed
 * or virtualized subset (no DP truncation).
 */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const lines = [headers, ...rows].map((line) =>
    line.map((cell) => escapeCsvField(String(cell))).join(','),
  );

  return lines.join('\r\n');
}
