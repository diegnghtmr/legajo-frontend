import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DendrogramCard } from './DendrogramCard';

class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}

  trigger(width: number): void {
    this.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

const GOLDEN_ROWS_N6 = [
  { idx1: 0, idx2: 1, mergeDistance: 0.1 },
  { idx1: 2, idx2: 3, mergeDistance: 0.2 },
  { idx1: 4, idx2: 5, mergeDistance: 0.3 },
  { idx1: 6, idx2: 7, mergeDistance: 0.4 },
  { idx1: 8, idx2: 9, mergeDistance: 0.5 },
];

afterEach(() => {
  vi.unstubAllGlobals();
  FakeResizeObserver.instances = [];
});

describe('DendrogramCard', () => {
  it('renders the linkage display name as a heading, and the dendrogram inside the named container', () => {
    render(
      <DendrogramCard
        linkageId="single"
        linkageDisplayName="Single"
        rows={GOLDEN_ROWS_N6}
        leafOrder={[0, 1, 2, 3, 4, 5]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Single' })).toBeInTheDocument();
    const container = screen.getByTestId('linkage-dendrogram-single');
    expect(
      within(container).getByRole('img', { name: 'Dendrograma de Single' }),
    ).toBeInTheDocument();
  });

  it('passes the cut down to the dendrogram unchanged', () => {
    render(
      <DendrogramCard
        linkageId="complete"
        linkageDisplayName="Complete"
        rows={GOLDEN_ROWS_N6}
        leafOrder={[0, 1, 2, 3, 4, 5]}
        cut={{ distance: 0.25, labels: [0, 0, 1, 1, 2, 2] }}
      />,
    );

    const container = screen.getByTestId('linkage-dendrogram-complete');
    expect(within(container).getByTestId('dendrogram-cut-line')).toBeInTheDocument();
  });

  it('measures its own container width via ResizeObserver and re-renders the dendrogram at that width', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    render(
      <DendrogramCard
        linkageId="single"
        linkageDisplayName="Single"
        rows={GOLDEN_ROWS_N6}
        leafOrder={[0, 1, 2, 3, 4, 5]}
      />,
    );

    const container = screen.getByTestId('linkage-dendrogram-single');
    const svgBefore = within(container).getByRole('img');
    const widthBefore = Number(svgBefore.getAttribute('width'));

    act(() => {
      FakeResizeObserver.instances[0]?.trigger(1200);
    });

    const svgAfter = within(container).getByRole('img');
    expect(Number(svgAfter.getAttribute('width'))).toBeGreaterThan(widthBefore);
  });

  it('grows the dendrogram height with the leaf count (dendrogramGridSizing.ts)', () => {
    const { rerender } = render(
      <DendrogramCard
        linkageId="single"
        linkageDisplayName="Single"
        rows={GOLDEN_ROWS_N6}
        leafOrder={[0, 1, 2, 3, 4, 5]}
      />,
    );

    const smallSvg = within(screen.getByTestId('linkage-dendrogram-single')).getByRole('img');
    const smallHeight = Number(smallSvg.getAttribute('height'));

    // A valid chain linkage matrix for n = 40 leaves: row 0 merges leaves 0
    // and 1 into cluster 40; each later row i merges the next unused leaf
    // (i + 1) with the previous row's own cluster (39 + i) -- the same
    // "idx1 < idx2, references an already-created leaf or cluster" shape
    // `dendrogramLayout.ts` requires.
    const leafCount = 40;
    const manyLeaves = Array.from({ length: leafCount }, (_unused, index) => index);
    const manyRows = [
      { idx1: 0, idx2: 1, mergeDistance: 1 },
      ...Array.from({ length: leafCount - 2 }, (_unused, index) => {
        const i = index + 1;
        return { idx1: i + 1, idx2: leafCount - 1 + i, mergeDistance: i + 1 };
      }),
    ];

    rerender(
      <DendrogramCard
        linkageId="single"
        linkageDisplayName="Single"
        rows={manyRows}
        leafOrder={manyLeaves}
      />,
    );

    const largeSvg = within(screen.getByTestId('linkage-dendrogram-single')).getByRole('img');
    expect(Number(largeSvg.getAttribute('height'))).toBeGreaterThan(smallHeight);
  });
});
