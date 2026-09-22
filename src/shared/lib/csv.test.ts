import { describe, expect, it } from 'vitest';

import { toCsv } from './csv';

describe('toCsv', () => {
  it('renders headers as the first row and every data row after it', () => {
    const csv = toCsv(
      ['', 'c', 'a', 't'],
      [
        ['c', 1, 2, 3],
        ['a', 4, 5, 6],
        ['t', 7, 8, 9],
      ],
    );

    expect(csv.split('\r\n')).toEqual([',c,a,t', 'c,1,2,3', 'a,4,5,6', 't,7,8,9']);
  });

  it('contains every cell value from a larger matrix, in row-major order, with no truncation', () => {
    const size = 12;
    const headers = ['', ...Array.from({ length: size }, (_, index) => `col-${index}`)];
    const rows = Array.from({ length: size }, (_, row) => [
      `row-${row}`,
      ...Array.from({ length: size }, (_, col) => row * size + col),
    ]);

    const csv = toCsv(headers, rows);
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(size + 1);
    for (let row = 0; row < size; row += 1) {
      const cells = lines[row + 1].split(',');
      // Row label + every column value for this row, nothing dropped.
      expect(cells).toHaveLength(size + 1);
      for (let col = 0; col < size; col += 1) {
        expect(cells[col + 1]).toBe(String(row * size + col));
      }
    }
  });

  it('quotes a field containing a comma, a double quote, or a newline (RFC 4180)', () => {
    const csv = toCsv(
      ['label', 'value'],
      [
        ['a,b', 'has "quotes"'],
        ['line\nbreak', 5],
      ],
    );

    expect(csv.split('\r\n')).toEqual(['label,value', '"a,b","has ""quotes"""', '"line\nbreak",5']);
  });
});
