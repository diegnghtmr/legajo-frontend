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

  it('renders two dendrograms with different leafOrder at different leaf y positions for the same leaf id', () => {
    const { container: first } = render(
      <Dendrogram rows={ROWS} leafOrder={[0, 1, 2, 3, 4]} ariaLabel="Identity order" />,
    );
    const { container: second } = render(
      <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Custom order" />,
    );

    function yById(container: HTMLElement): Map<string, string | null> {
      return new Map(
        [...container.querySelectorAll('[data-leaf-id]')].map((node) => [
          node.getAttribute('data-leaf-id')!,
          node.getAttribute('data-leaf-y'),
        ]),
      );
    }

    const firstYById = yById(first);
    const secondYById = yById(second);

    expect(firstYById.get('0')).not.toBe(secondYById.get('0'));
    expect(firstYById.get('2')).not.toBe(secondYById.get('2'));
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

  it('wraps the merge table in a plain sr-only div, never `sr-only` on the table element itself', () => {
    // jsdom performs no real layout, so this cannot assert an actual
    // clipped/visible pixel size (`e2e/sr-only-caption-clip.spec.ts` does,
    // against a real browser). What jsdom CAN pin is the DOM shape the fix
    // depends on: a table generates two boxes — an anonymous "table wrapper
    // box" that takes `position`/`margin`, and the "table box" proper that
    // takes `width`/`height`/`overflow` — so `sr-only` directly on a
    // `<table>` clips only its grid of rows/cells, never its own
    // `<caption>`, which sits in that unclipped wrapper box (verified
    // against a live render: the caption escaped at its own full wrapped
    // size). A plain `<div>` has no such split, so wrapping the whole table
    // — caption included — in `sr-only` there clips everything to one box
    // regardless of the table's own layout.
    const { container } = render(
      <Dendrogram
        rows={ROWS}
        leafOrder={LEAF_ORDER}
        ariaLabel="Single dendrogram"
        leafLabels={LEAF_LABELS}
      />,
    );

    expect(container.querySelector('table.sr-only')).not.toBeInTheDocument();
    const wrapper = container.querySelector('div.sr-only');
    expect(wrapper).toBeInTheDocument();
    const table = wrapper?.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(table?.querySelector('caption')).toBeInTheDocument();
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

  it('heightens the rendered SVG to keep a minimum per-leaf spacing on a corpus too large for the requested height, rather than cramming leaves together — while its width always stays exactly the given, responsive card width', () => {
    const manyLeaves = Array.from({ length: 10 }, (_unused, index) => ({
      idx1: index,
      idx2: index + 1,
      mergeDistance: index + 1,
    }));

    const { container } = render(
      <Dendrogram
        rows={manyLeaves}
        leafOrder={Array.from({ length: 11 }, (_unused, index) => index)}
        ariaLabel="Tall dendrogram"
        width={200}
      />,
    );

    const svg = container.querySelector('svg')!;
    const renderedWidth = Number(svg.getAttribute('width'));
    const renderedHeight = Number(svg.getAttribute('height'));
    // The card's own width (leaves run vertically now) is never grown past
    // what was given — a 200px card stays exactly 200px wide.
    expect(renderedWidth).toBe(200);
    // The default 220px height is far too short for 11 leaves at a legible
    // spacing; the component must heighten past what was asked for rather
    // than shrink its labels to fit.
    expect(renderedHeight).toBeGreaterThan(220);
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${renderedWidth} ${renderedHeight}`);
  });

  it('keeps the default height when it already gives every leaf enough room', () => {
    const { container } = render(
      <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />,
    );

    const svg = container.querySelector('svg')!;
    // 5 leaves comfortably fit the 220px default; the fix must not
    // heighten a chart that was already tall enough.
    expect(svg.getAttribute('height')).toBe('220');
  });
});
