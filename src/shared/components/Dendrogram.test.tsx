import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dendrogram } from './Dendrogram';

/** Same golden n = 5 matrix as `dendrogramLayout.test.ts`. */
const ROWS = [
  { idx1: 0, idx2: 1, mergeDistance: 1 },
  { idx1: 2, idx2: 3, mergeDistance: 2 },
  { idx1: 4, idx2: 5, mergeDistance: 3 },
  { idx1: 6, idx2: 7, mergeDistance: 4 },
];
const LEAF_ORDER = [2, 3, 0, 1, 4];
const LEAF_LABELS = [
  { label: 'doc-00', title: 'Zeroth article' },
  { label: 'doc-01', title: 'First article' },
  { label: 'doc-02', title: 'Second article' },
  { label: 'doc-03', title: 'Third article' },
  { label: 'doc-04', title: 'Fourth article' },
];

describe('Dendrogram', () => {
  it('renders one SVG path per merge row and an accessible role="img" with the given label', () => {
    const { container } = render(
      <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />,
    );

    expect(container.querySelectorAll('path')).toHaveLength(ROWS.length);
    expect(screen.getByRole('img', { name: 'Single dendrogram' })).toBeInTheDocument();
  });

  it('shows every leaf mono label exactly once, ordered by leafOrder rather than raw id', () => {
    const { container } = render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
      />,
    );

    // Scoped to the visible SVG leaf labels only — the sr-only merge table
    // repeats some of the same document ids as text of its own.
    const texts = [...container.querySelectorAll('svg text.font-mono')].map(
      (node) => node.textContent,
    );
    expect(texts).toEqual(['doc-02', 'doc-03', 'doc-00', 'doc-01', 'doc-04']);
  });

  it('falls back to the plain numeric id when no leaf label is supplied', () => {
    render(<Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />);

    expect(screen.getByText('2', { selector: 'text' })).toBeInTheDocument();
    expect(screen.getByText('4', { selector: 'text' })).toBeInTheDocument();
  });

  it('renders two dendrograms with different leafOrder at different leaf x positions for the same leaf id', () => {
    const { container: first } = render(
      <Dendrogram rows={ROWS} leafOrder={[0, 1, 2, 3, 4]} ariaLabel="Identity order" />,
    );
    const { container: second } = render(
      <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Custom order" />,
    );

    function xById(container: HTMLElement): Map<string, string | null> {
      return new Map(
        [...container.querySelectorAll('[data-leaf-id]')].map((node) => [
          node.getAttribute('data-leaf-id')!,
          node.getAttribute('data-leaf-x'),
        ]),
      );
    }

    const firstXById = xById(first);
    const secondXById = xById(second);

    expect(firstXById.get('0')).not.toBe(secondXById.get('0'));
    expect(firstXById.get('2')).not.toBe(secondXById.get('2'));
  });

  it('renders an accessible sr-only table listing every merge step in order', () => {
    render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
      />,
    );

    const table = screen.getByRole('table', { hidden: true });
    const rows = within(table).getAllByRole('row', { hidden: true });
    // header row + 4 merge rows
    expect(rows).toHaveLength(ROWS.length + 1);
    expect(within(rows[1]!).getByText('doc-00')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('doc-01')).toBeInTheDocument();
  });

  it('draws no dashed cut line without a cut prop', () => {
    const { container } = render(
      <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />,
    );

    expect(container.querySelector('[data-testid="dendrogram-cut-line"]')).not.toBeInTheDocument();
  });

  it('draws exactly one dashed cut line and the cluster number per leaf once a cut is provided', () => {
    const { container } = render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
        cut={{ distance: 2.5, labels: [0, 0, 1, 1, 2] }}
      />,
    );

    const cutLines = container.querySelectorAll('[data-testid="dendrogram-cut-line"]');
    expect(cutLines).toHaveLength(1);
    expect(cutLines[0]?.getAttribute('stroke-dasharray')).toBeTruthy();
    // labels = [0, 0, 1, 1, 2] -> two leaves in cluster 0, two in cluster 1, one in cluster 2.
    expect(screen.getAllByText('Clúster 0')).toHaveLength(2);
    expect(screen.getAllByText('Clúster 1')).toHaveLength(2);
    expect(screen.getAllByText('Clúster 2')).toHaveLength(1);
  });

  it('renders no cluster text for a leaf whose cut label is undefined, while other leaves still render', () => {
    const { container } = render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
        cut={{ distance: 2.5, labels: [0, undefined, 1, 1, 2] }}
      />,
    );

    // Leaf id 1's cut label is undefined: its group gets no cluster-number
    // <text> node at all (not merely a blank one), while every other leaf's
    // group still renders its own.
    for (const leafId of [0, 2, 3, 4]) {
      expect(container.querySelector(`[data-leaf-id="${leafId}"] text.fill-ink`)).not.toBeNull();
    }
    expect(container.querySelector('[data-leaf-id="1"] text.fill-ink')).toBeNull();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it('shows a translated, non-crashing error instead of drawing a malformed matrix', () => {
    render(
      <Dendrogram rows={ROWS.slice(0, 2)} leafOrder={LEAF_ORDER} ariaLabel="Broken dendrogram" />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo dibujar el dendrograma de este enlace.',
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
