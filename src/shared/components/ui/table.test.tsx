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
});
