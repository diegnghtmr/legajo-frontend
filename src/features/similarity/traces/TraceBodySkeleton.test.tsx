import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TraceBodySkeleton } from './TraceBodySkeleton';

describe('TraceBodySkeleton', () => {
  it('for a DP algorithm, mirrors the matrix viewport, the legend, the operations region and the formula caption', async () => {
    const { container } = render(<TraceBodySkeleton algorithmId="levenshtein" />);

    // The matrix's own bounded box (`DpMatrix`'s own `max-h-[420px]`),
    // clipped rather than scrolled: a skeleton is no landmark and no tab stop.
    const matrixBox = container.querySelector('.max-h-\\[420px\\]');
    expect(matrixBox).toHaveClass('overflow-hidden');
    expect(matrixBox).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('region', { name: 'Matriz completa de levenshtein' })).toBeNull();

    // The operation legend and vocabulary are already known from the
    // algorithm id alone — real text, never a placeholder.
    expect(screen.getByRole('heading', { name: 'Leyenda de operaciones' })).toBeInTheDocument();
    expect(screen.getByText('Coincidencia')).toBeInTheDocument();
    expect(screen.getByText('Sustitución')).toBeInTheDocument();
    expect(screen.getByText('Inserción')).toBeInTheDocument();
    expect(screen.getByText('Eliminación')).toBeInTheDocument();

    // The operations table's own bounded box (`max-h-64`/256px), also
    // reused verbatim and clipped.
    const operationsBox = container.querySelector('.max-h-64');
    expect(operationsBox).toHaveClass('overflow-hidden');
    expect(operationsBox).not.toHaveAttribute('tabindex');

    // The formula needs no fetched data at all — it renders for real
    // immediately, exactly as it will once the trace resolves.
    expect(
      await screen.findByText('Recurrencia de Levenshtein: mínimo costo de edición'),
    ).toBeInTheDocument();

    // Every decorative placeholder stays hidden from assistive tech; the
    // static text above is what a screen reader actually gets.
    for (const block of document.querySelectorAll('[data-slot="skeleton"]')) {
      expect(block).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('for the other DP algorithm (Needleman–Wunsch), shows its own operation vocabulary and formula', async () => {
    render(<TraceBodySkeleton algorithmId="needleman-wunsch" />);

    expect(screen.getByText('Coincidencia')).toBeInTheDocument();
    expect(screen.getByText('Discrepancia')).toBeInTheDocument();
    expect(screen.getByText('Hueco')).toBeInTheDocument();
    expect(
      await screen.findByText('Recurrencia de Needleman–Wunsch: máxima puntuación de alineamiento'),
    ).toBeInTheDocument();
  });

  it('hides the download button placeholder when the caller (the docked panel) renders its own instead', () => {
    render(<TraceBodySkeleton algorithmId="levenshtein" hideDownloadButton />);

    expect(screen.queryByTestId('trace-body-skeleton-download-button')).not.toBeInTheDocument();
  });

  it('shows a download button placeholder for the standalone full trace view', () => {
    render(<TraceBodySkeleton algorithmId="levenshtein" />);

    expect(screen.getByTestId('trace-body-skeleton-download-button')).toBeInTheDocument();
  });

  it('for an embedding algorithm, shows every fixed field label as real text over a placeholder value', () => {
    render(<TraceBodySkeleton algorithmId="embedding-api" />);

    for (const label of [
      'Proveedor',
      'Modelo',
      'Dimensión',
      'Extracto del vector A (8 primeras)',
      'Extracto del vector B (8 primeras)',
      'Norma previa a normalizar (A)',
      'Norma previa a normalizar (B)',
      'Suma de diferencias al cuadrado',
      'Distancia euclidiana',
      'Puntaje normalizado',
      'Estado del proveedor',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('for the local embedding algorithm, shows its own dot-product/cosine/angle fields instead of the API ones', () => {
    render(<TraceBodySkeleton algorithmId="embedding-local" />);

    expect(screen.getByText('Producto punto')).toBeInTheDocument();
    expect(screen.getByText('Coseno')).toBeInTheDocument();
    expect(screen.getByText('Ángulo (°)')).toBeInTheDocument();
    expect(screen.queryByText('Estado del proveedor')).not.toBeInTheDocument();
  });

  it("for Jaccard, shows the fixed group and set-size labels as real text, each group sized to this corpus's own typical token count", () => {
    render(<TraceBodySkeleton algorithmId="jaccard" />);

    expect(screen.getByText('Solo en A')).toBeInTheDocument();
    expect(screen.getByText('En ambos')).toBeInTheDocument();
    expect(screen.getByText('Solo en B')).toBeInTheDocument();
    expect(screen.getByText('|S_A|')).toBeInTheDocument();
    expect(screen.getByText('|S_B|')).toBeInTheDocument();

    // Every token-group placeholder is an invisible sizer of token-shaped
    // chips (the real corpus's own typical count) under a `Skeleton`
    // overlay — never a single fixed-width bar, which a long real token
    // list would overflow well past.
    const sizers = document.querySelectorAll('[data-token-sizer]');
    expect(sizers).toHaveLength(3);
    const tokenCounts = [...sizers].map((sizer) => sizer.children.length);
    expect(tokenCounts.sort((a, b) => a - b)).toEqual([16, 80, 84]);
  });

  it('for TF-IDF/cosine, shows the corpus-size label and the terms region shell as real text, with a real-corpus-typical term row count', () => {
    const { container } = render(<TraceBodySkeleton algorithmId="tfidf-cosine" />);

    expect(screen.getByText('Tamaño del corpus (N)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pesos término a término' })).toBeInTheDocument();
    const table = container.querySelector('table')!;
    const region = table.parentElement!;
    expect(region).toHaveClass('overflow-hidden');
    expect(region).not.toHaveAttribute('tabindex');
    expect(within(region).getByText('Término')).toBeInTheDocument();

    // The terms table has no bounded viewport of its own (unlike the DP
    // matrix/operations regions above): on the full-screen view every row
    // it renders pushes the whole page taller, so this reserves the real
    // corpus's own typical term count rather than a handful of rows.
    expect(within(region).getAllByRole('row')).toHaveLength(181); // header + 180 terms
  });

  describe('the DP meta row (Familia, Camino óptimo)', () => {
    it('reserves it by default, for the standalone full trace view', () => {
      render(<TraceBodySkeleton algorithmId="levenshtein" />);

      expect(screen.getByText('Familia')).toBeInTheDocument();
      expect(screen.getByText('Camino óptimo')).toBeInTheDocument();
    });

    it('hides it when the caller (the docked trace panel) renders its own generic meta row instead', () => {
      render(<TraceBodySkeleton algorithmId="levenshtein" hideDpMetaRow />);

      expect(screen.queryByText('Familia')).not.toBeInTheDocument();
      expect(screen.queryByText('Camino óptimo')).not.toBeInTheDocument();
    });

    it('is never rendered for a non-DP algorithm, hidden or not', () => {
      render(<TraceBodySkeleton algorithmId="jaccard" />);

      expect(screen.queryByText('Familia')).not.toBeInTheDocument();
      expect(screen.queryByText('Camino óptimo')).not.toBeInTheDocument();
    });
  });
});
