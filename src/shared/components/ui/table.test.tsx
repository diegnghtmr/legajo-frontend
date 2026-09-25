import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('Table', () => {
  it('renders a semantic table with a header row and body rows', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Algorithm</TableHead>
            <TableHead>Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>levenshtein</TableCell>
            <TableCell>0.82</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Algorithm' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('cell', { name: 'levenshtein' })).toBeInTheDocument();
  });

  it('applies the paper-sunken eyebrow treatment to the header', () => {
    render(
      <Table>
        <TableHeader data-testid="head">
          <TableRow>
            <TableHead>Algorithm</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    expect(screen.getByTestId('head').className).toContain('bg-paper-sunken');
  });

  it('wraps the table in its own overflow-x-auto scroll container by default', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>levenshtein</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const table = screen.getByRole('table');
    expect(table.parentElement?.className).toContain('overflow-x-auto');
  });

  it('skips its own wrapper when wrap={false}, so a caller can use one single scroll container (needed for sticky headers/columns, which break under nested overflow wrappers)', () => {
    render(
      <div data-testid="caller-scroll-container" className="max-h-64 overflow-auto">
        <Table wrap={false}>
          <TableBody>
            <TableRow>
              <TableCell>levenshtein</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>,
    );

    const table = screen.getByRole('table');
    expect(table.parentElement).toBe(screen.getByTestId('caller-scroll-container'));
  });
});
