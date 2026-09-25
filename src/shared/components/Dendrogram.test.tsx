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

  it('draws exactly one dashed cut line and a compact cluster-number marker per leaf once a cut is provided', () => {
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
    // labels = [0, 0, 1, 1, 2] indexed by original leaf id; rendered in
    // LEAF_ORDER's visual order ([2, 3, 0, 1, 4]) that is [1, 1, 0, 0, 2].
    // A bare, compact number (not the full "Clúster N" word), so labels stay
    // legible at the default leaf spacing instead of overlapping.
    const markers = [...container.querySelectorAll('[data-testid="cluster-marker"]')];
    expect(markers.map((marker) => marker.textContent)).toEqual(['1', '1', '0', '0', '2']);
    // Each marker is aria-hidden — the full name is carried by the leaf's
    // own <title> instead, asserted below — never announced as a bare digit.
    for (const marker of markers) {
      expect(marker).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it("appends the cluster label to the leaf's own accessible title once a cut is provided", () => {
    const { container } = render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
        cut={{ distance: 2.5, labels: [0, 0, 1, 1, 2] }}
      />,
    );

    const leafZeroTitle = container.querySelector('[data-leaf-id="0"] title');
    expect(leafZeroTitle).toHaveTextContent('Zeroth article — Clúster 0');
  });

  it('shows a legend captioning what the cluster numbers mean, naming k', () => {
    render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
        cut={{ distance: 2.5, labels: [0, 0, 1, 1, 2] }}
      />,
    );

    expect(screen.getByText('Números de clúster (k = 3) debajo de cada hoja')).toBeInTheDocument();
  });

  it('shows no legend without a cut', () => {
    render(<Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />);

    expect(screen.queryByText(/Números de clúster/)).not.toBeInTheDocument();
  });

  it('makes the sr-only merge table collapse instead of growing to its content width', () => {
    // jsdom performs no real layout, so this cannot assert an actual
    // scrollWidth. The CSS contract that keeps the visually-hidden table
    // from widening the page's own scrollable area in a real browser is
    // `table-fixed` (stop growing to fit content) *and* `whitespace-normal`
    // (override `sr-only`'s own `nowrap`, which otherwise still lets each
    // cell's full text count as one unbreakable run even under
    // `table-fixed` — verified against a live render); this asserts both
    // classes are present together, since either alone left it overflowing.
    const { container } = render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
      />,
    );

    const table = container.querySelector('table.sr-only');
    expect(table).toHaveClass('table-fixed');
    expect(table).toHaveClass('whitespace-normal');
  });

  it('renders no cluster marker for a leaf whose cut label is undefined, while other leaves still render one', () => {
    const { container } = render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
        cut={{ distance: 2.5, labels: [0, undefined, 1, 1, 2] }}
      />,
    );

    // Leaf id 1's cut label is undefined: its group gets no cluster-marker
    // <text> node at all (not merely a blank one), while every other leaf's
    // group still renders its own.
    for (const leafId of [0, 2, 3, 4]) {
      expect(
        container.querySelector(`[data-leaf-id="${leafId}"] [data-testid="cluster-marker"]`),
      ).not.toBeNull();
    }
    expect(container.querySelector('[data-leaf-id="1"] [data-testid="cluster-marker"]')).toBeNull();
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

  it('wraps the chart in its own focusable, labelled scroll region instead of letting the page scroll', () => {
    render(<Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />);

    const region = screen.getByRole('region', { name: 'Single dendrogram' });
    expect(region).toHaveAttribute('tabIndex', '0');
    expect(region.className).toContain('overflow-x-auto');
    expect(region).toContainElement(screen.getByRole('img', { name: 'Single dendrogram' }));
  });

  it('never shrinks the SVG below its natural size (no CSS scale-down of the rendered text)', () => {
    const { container } = render(
      <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />,
    );

    // `max-w-full` is exactly the class that let the browser scale the whole
    // coordinate system (labels included) down to fit a narrow container;
    // removing it means the SVG always renders at its own intrinsic size and
    // only the wrapping region (above) scrolls.
    const svg = container.querySelector('svg')!;
    expect(svg.className.baseVal).not.toContain('max-w-full');
  });

  it('widens the rendered SVG to keep a minimum per-leaf spacing on a corpus too large for the requested width, rather than cramming leaves together', () => {
    const manyLeaves = Array.from({ length: 10 }, (_unused, index) => ({
      idx1: index,
      idx2: index + 1,
      mergeDistance: index + 1,
    }));

    const { container } = render(
      <Dendrogram
        rows={manyLeaves}
        leafOrder={Array.from({ length: 11 }, (_unused, index) => index)}
        ariaLabel="Wide dendrogram"
        width={200}
      />,
    );

    const svg = container.querySelector('svg')!;
    const renderedWidth = Number(svg.getAttribute('width'));
    // A 200px request is far too narrow for 11 leaves at a legible spacing;
    // the component must widen past what was asked for rather than shrink
    // its labels to fit.
    expect(renderedWidth).toBeGreaterThan(200);
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${renderedWidth} 220`);
  });

  it('keeps the default width when it already gives every leaf enough room', () => {
    const { container } = render(
      <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />,
    );

    const svg = container.querySelector('svg')!;
    // 5 leaves comfortably fit the 640px default; the fix must not widen a
    // chart that was already wide enough.
    expect(svg.getAttribute('width')).toBe('640');
  });
});
