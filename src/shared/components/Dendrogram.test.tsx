import { fireEvent, render, screen, within } from '@testing-library/react';
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
    const texts = [...container.querySelectorAll('svg text[data-leaf-label]')].map(
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
    // LEAF_ORDER's visual order ([2, 3, 0, 1, 4]) that is [1, 1, 0, 0, 2],
    // shown one-based as people count clusters: [2, 2, 1, 1, 3].
    // A bare, compact number (not the full "Clúster N" word), so labels stay
    // legible at the default leaf spacing instead of overlapping.
    const markers = [...container.querySelectorAll('[data-testid="cluster-marker"]')];
    expect(markers.map((marker) => marker.textContent)).toEqual(['2', '2', '1', '1', '3']);
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
    expect(leafZeroTitle).toHaveTextContent('Zeroth article — Clúster 1');
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

    expect(
      screen.getByText(
        'Los números son los clústeres para k = 3. Pasa el cursor por una hoja para ver su título.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no legend without a cut', () => {
    render(<Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />);

    expect(screen.queryByText(/Los números son los clústeres/)).not.toBeInTheDocument();
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
    // The default 220px height is far too short for 11 leaves at 22px a
    // leaf; the component must heighten past what was asked for rather than
    // shrink its labels to fit: (n - 1) x 22 + 60.
    expect(renderedHeight).toBe(280);
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

  describe('distance axis', () => {
    it('titles the axis "Distancia" and prints mono tick labels at nice steps', () => {
      const { container } = render(
        <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" width={640} />,
      );

      const title = container.querySelector('[data-axis-title]')!;
      expect(title).toHaveTextContent('Distancia');
      const ticks = [...container.querySelectorAll('[data-axis-tick] text')];
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      for (const tick of ticks) {
        expect(tick.getAttribute('class')).toContain('font-mono');
      }
      const values = ticks.map((tick) => Number(tick.textContent));
      const step = values[1]! - values[0]!;
      expect([1, 2, 2.5, 5, 0.5, 0.25, 0.2, 0.1]).toContain(step);
    });

    it('draws a dashed hairline gridline per tick', () => {
      const { container } = render(
        <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" width={640} />,
      );

      const grid = container.querySelectorAll('[data-axis-tick] line');
      expect(grid.length).toBeGreaterThanOrEqual(3);
      for (const line of grid) {
        expect(line.getAttribute('stroke-dasharray')).toBeTruthy();
        expect(line.getAttribute('class')).toContain('stroke-chart-grid');
      }
    });

    it('fits the domain to the merge range: the first merge is drawn clear of the leaf edge', () => {
      const { container } = render(
        <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" width={640} />,
      );

      const leafEdge = 640 - 104 - 12;
      const firstMerge = container.querySelector('[data-merge-hit="5"]')!;
      expect(Number(firstMerge.getAttribute('cx'))).toBeLessThan(leafEdge - 10);
      // ...and the root sits inside the plot, not on its far edge.
      const root = container.querySelector('[data-merge-hit="8"]')!;
      expect(Number(root.getAttribute('cx'))).toBeGreaterThan(1);
    });
  });

  describe('cut preview', () => {
    it('draws a dotted ink-muted line labelled with its k, and none without the prop', () => {
      const { container, rerender } = render(
        <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />,
      );
      expect(container.querySelector('[data-testid="dendrogram-preview-line"]')).toBeNull();

      rerender(
        <Dendrogram
          rows={ROWS}
          leafOrder={LEAF_ORDER}
          ariaLabel="Single dendrogram"
          preview={{ k: 3, distance: 2.5 }}
        />,
      );

      const line = container.querySelector('[data-testid="dendrogram-preview-line"]')!;
      expect(line.getAttribute('class')).toContain('stroke-ink-muted');
      expect(line.getAttribute('stroke-dasharray')).toBe('1 3');
      expect(container.querySelector('[data-testid="dendrogram-preview-label"]')).toHaveTextContent(
        'k = 3',
      );
    });

    it('sits at the given distance, on the same scale as the cut line', () => {
      const { container } = render(
        <Dendrogram
          rows={ROWS}
          leafOrder={LEAF_ORDER}
          ariaLabel="Single dendrogram"
          preview={{ k: 3, distance: 2.5 }}
          cut={{ distance: 2.5, labels: [0, 0, 1, 1, 2] }}
        />,
      );

      const preview = container.querySelector('[data-testid="dendrogram-preview-line"]')!;
      const cut = container.querySelector('[data-testid="dendrogram-cut-line"]')!;
      expect(preview.getAttribute('x1')).toBe(cut.getAttribute('x1'));
    });
  });

  describe('applied cut', () => {
    const CUT = { distance: 2.5, labels: [0, 0, 1, 1, 2], k: 3 };
    const renderCut = () =>
      render(
        <Dendrogram
          rows={ROWS}
          leafOrder={LEAF_ORDER}
          ariaLabel="Single dendrogram"
          leafLabels={LEAF_LABELS}
          cut={CUT}
        />,
      );

    it('draws the dashed warning line with a "k = n" chip: ink text on warning-soft with a warning border', () => {
      const { container } = renderCut();

      const line = container.querySelector('[data-testid="dendrogram-cut-line"]')!;
      expect(line.getAttribute('class')).toContain('stroke-warning');
      expect(line.getAttribute('stroke-dasharray')).toBe('6 4');
      const chip = container.querySelector('[data-testid="dendrogram-cut-chip"]')!;
      const rect = chip.querySelector('rect')!;
      expect(rect.getAttribute('class')).toContain('fill-warning-soft');
      expect(rect.getAttribute('class')).toContain('stroke-warning');
      expect(rect.getAttribute('rx')).toBe('4');
      expect(chip.querySelector('text')!.getAttribute('class')).toContain('fill-ink');
      expect(chip).toHaveTextContent('k = 3');
    });

    it('takes the chip k from the cut when given, and counts distinct labels otherwise', () => {
      const { container } = render(
        <Dendrogram
          rows={ROWS}
          leafOrder={LEAF_ORDER}
          ariaLabel="Single dendrogram"
          cut={{ distance: 2.5, labels: [0, 0, 1, 1, 2] }}
        />,
      );

      expect(container.querySelector('[data-testid="dendrogram-cut-chip"]')).toHaveTextContent(
        'k = 3',
      );
    });

    it('colours a branch whose leaves share one cluster with that cluster hue, and keeps the branches above the cut ink-muted', () => {
      const { container } = renderCut();

      const path = (id: number) => container.querySelector(`path[data-merge-id="${id}"]`)!;
      // (0, 1) are both cluster 0 -> cluster-1; (2, 3) both cluster 1 -> cluster-2.
      expect(path(5).getAttribute('class')).toContain('stroke-cluster-1');
      expect(path(6).getAttribute('class')).toContain('stroke-cluster-2');
      expect(path(5).getAttribute('stroke-width')).toBe('2');
      // Mixed clusters below the root: above the cut.
      expect(path(7).getAttribute('class')).toContain('stroke-ink-muted');
      expect(path(8).getAttribute('class')).toContain('stroke-ink-muted');
    });

    it('keeps every branch ink before a cut', () => {
      const { container } = render(
        <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />,
      );

      for (const path of container.querySelectorAll('path')) {
        expect(path.getAttribute('class')).toContain('stroke-ink');
        expect(path.getAttribute('class')).not.toContain('stroke-cluster');
      }
    });

    it('wraps the hue around after eight clusters', () => {
      const rows = Array.from({ length: 9 }, (_unused, index) => ({
        idx1: index === 0 ? 0 : index + 1,
        idx2: index === 0 ? 1 : 10 + index - 1,
        mergeDistance: index + 1,
      }));
      const { container } = render(
        <Dendrogram
          rows={rows}
          leafOrder={Array.from({ length: 10 }, (_unused, index) => index)}
          ariaLabel="Wide"
          cut={{ distance: 9.5, labels: [8, 1, 2, 3, 4, 5, 6, 7, 0, 9] }}
        />,
      );

      const chips = [...container.querySelectorAll('[data-testid="cluster-marker"]')];
      const hue = (label: string) =>
        chips
          .find((chip) => chip.textContent === label)!
          .previousElementSibling!.getAttribute('class');
      expect(hue('9')).toContain('fill-cluster-1');
      expect(hue('1')).toContain('fill-cluster-1');
      expect(hue('10')).toContain('fill-cluster-2');
    });

    it('draws a numbered chip in the cluster hue after each leaf label', () => {
      const { container } = renderCut();

      const leaf = container.querySelector('[data-leaf-id="0"]')!;
      const rect = leaf.querySelector('rect.fill-cluster-1')!;
      expect(rect.getAttribute('width')).toBe('22');
      expect(rect.getAttribute('height')).toBe('16');
      expect(rect.getAttribute('rx')).toBe('4');
      const number = leaf.querySelector('[data-testid="cluster-marker"]')!;
      expect(number).toHaveTextContent('1');
      expect(number.getAttribute('class')).toContain('fill-paper-raised');
    });
  });

  describe('tooltips', () => {
    const renderTip = () =>
      render(
        <Dendrogram
          rows={ROWS}
          leafOrder={LEAF_ORDER}
          ariaLabel="Single dendrogram"
          leafLabels={LEAF_LABELS}
          cut={{ distance: 2.5, labels: [0, 0, 1, 1, 2], k: 3 }}
        />,
      );

    it('shows no tooltip until something is hovered', () => {
      renderTip();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('hovering a leaf shows its mono id, its cluster and its corpus title, and leaving hides it', () => {
      const { container } = renderTip();

      fireEvent.pointerEnter(container.querySelector('[data-leaf-id="0"]')!);

      const tip = screen.getByRole('tooltip');
      expect(within(tip).getByText('doc-00')).toHaveClass('font-mono');
      expect(tip).toHaveTextContent('Clúster 1');
      expect(tip).toHaveTextContent('Zeroth article');
      expect(tip).toHaveClass('pointer-events-none');

      fireEvent.pointerLeave(container.querySelector('[data-leaf-id="0"]')!);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('hovering a merge shows its step out of n - 1, its distance to four decimals and its size', () => {
      const { container } = renderTip();

      fireEvent.pointerEnter(container.querySelector('[data-merge-hit="7"]')!);

      const tip = screen.getByRole('tooltip');
      expect(tip).toHaveTextContent('Paso');
      expect(tip).toHaveTextContent('3 / 4');
      expect(tip).toHaveTextContent('3.0000');
      expect(tip).toHaveTextContent('Tamaño');
      expect(tip).toHaveTextContent('3');
    });

    it('leaves out the cluster line before a cut', () => {
      const { container } = render(
        <Dendrogram
          rows={ROWS}
          leafOrder={LEAF_ORDER}
          ariaLabel="Single dendrogram"
          leafLabels={LEAF_LABELS}
        />,
      );

      fireEvent.pointerEnter(container.querySelector('[data-leaf-id="0"]')!);

      expect(screen.getByRole('tooltip')).not.toHaveTextContent('Clúster');
    });

    it('highlights a hovered merge subtree: other branches drop to 0.25 and other leaves to 0.35', () => {
      const { container } = renderTip();

      fireEvent.pointerEnter(container.querySelector('[data-merge-hit="7"]')!);

      const opacity = (selector: string) =>
        (container.querySelector(selector) as SVGElement).style.opacity;
      // Merge 7 holds leaves 4, 0, 1 (with merge 5).
      expect(opacity('path[data-merge-id="7"]')).toBe('1');
      expect(opacity('path[data-merge-id="5"]')).toBe('1');
      expect(opacity('path[data-merge-id="6"]')).toBe('0.25');
      expect(opacity('[data-leaf-id="0"]')).toBe('1');
      expect(opacity('[data-leaf-id="2"]')).toBe('0.35');

      fireEvent.pointerLeave(container.querySelector('[data-merge-hit="7"]')!);
      expect(opacity('path[data-merge-id="6"]')).toBe('1');
      expect(opacity('[data-leaf-id="2"]')).toBe('1');
    });

    it('never carries information the sr-only merge table does not', () => {
      renderTip();

      const table = screen.getByRole('table', { hidden: true });
      expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(ROWS.length + 1);
    });
  });

  describe('draw-in', () => {
    it('draws each branch from its leaves, staggered by merge step', () => {
      const { container } = render(
        <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Single dendrogram" />,
      );

      const paths = [...container.querySelectorAll('path')];
      paths.forEach((path, index) => {
        expect(path.getAttribute('pathLength')).toBe('1');
        expect(path.getAttribute('class')).toContain('draw-in');
        expect(path.style.getPropertyValue('--i')).toBe(String(index));
      });
    });
  });

  it('names the merge-order table once, without repeating the dendrogram name', () => {
    const { container } = render(
      <Dendrogram rows={ROWS} leafOrder={LEAF_ORDER} ariaLabel="Dendrograma de Single" />,
    );

    const caption = container.querySelector('caption')!;
    expect(caption).toHaveTextContent('Orden de fusión: Dendrograma de Single');
    expect(caption.textContent!.match(/dendrograma de/gi)).toHaveLength(1);
  });
});
