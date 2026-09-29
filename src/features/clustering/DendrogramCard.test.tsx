import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubLaidOutWidth } from '../../test/layout';
import { DendrogramCard } from './DendrogramCard';
import { dendrogramCardHeight } from './dendrogramGridSizing';

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

beforeEach(() => {
  stubLaidOutWidth(640);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it('draws nothing, in a box of its final height, while its width is still unknown', () => {
    vi.restoreAllMocks();

    render(
      <DendrogramCard
        linkageId="single"
        linkageDisplayName="Single"
        rows={GOLDEN_ROWS_N6}
        leafOrder={[0, 1, 2, 3, 4, 5]}
      />,
    );

    const container = screen.getByTestId('linkage-dendrogram-single');
    expect(within(container).queryByRole('img')).not.toBeInTheDocument();
    const measured = container.querySelector<HTMLElement>('.mt-3');
    expect(measured?.style.minHeight).toBe(`${dendrogramCardHeight(6)}px`);
  });

  it('draws at the measured width on its very first render, with no observer callback', () => {
    stubLaidOutWidth(812);

    render(
      <DendrogramCard
        linkageId="single"
        linkageDisplayName="Single"
        rows={GOLDEN_ROWS_N6}
        leafOrder={[0, 1, 2, 3, 4, 5]}
      />,
    );

    const svg = within(screen.getByTestId('linkage-dendrogram-single')).getByRole('img');
    expect(svg.getAttribute('width')).toBe('812');
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

  const renderCard = (props: Partial<React.ComponentProps<typeof DendrogramCard>> = {}) =>
    render(
      <DendrogramCard
        linkageId="single"
        linkageDisplayName="Single"
        rows={GOLDEN_ROWS_N6}
        leafOrder={[0, 1, 2, 3, 4, 5]}
        cophenetic={0.9512}
        {...props}
      />,
    );

  it('shows the cophenetic value as the card subtitle', () => {
    renderCard();

    expect(screen.getByText('Cofenética 0.951')).toBeInTheDocument();
  });

  it('shows the leader badges as the card actions', () => {
    renderCard({ leaders: { tree: true, partition: true } });

    const container = screen.getByTestId('linkage-dendrogram-single');
    expect(within(container).getByText('Árbol')).toBeInTheDocument();
    expect(within(container).getByText('Partición')).toBeInTheDocument();
  });

  it('shows no leader badge for a card that leads nothing', () => {
    renderCard();

    expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
    expect(screen.queryByText('Partición')).not.toBeInTheDocument();
  });

  it('marks the cut card with a "k = n" marker badge', () => {
    renderCard({ cut: { distance: 0.25, labels: [0, 0, 1, 1, 2, 2], k: 3 } });

    const container = screen.getByTestId('linkage-dendrogram-single');
    const marker = within(container).getAllByText('k = 3', { selector: 'span' })[0]!;
    expect(marker.className).toContain('font-mono');
  });

  it('draws the dotted preview line at the midpoint for a valid preview k', () => {
    renderCard({ previewK: 3 });

    const container = screen.getByTestId('linkage-dendrogram-single');
    expect(within(container).getByTestId('dendrogram-preview-line')).toBeInTheDocument();
    expect(within(container).getByTestId('dendrogram-preview-label')).toHaveTextContent('k = 3');
  });

  it('draws no preview for a k the loaded rows cannot place', () => {
    renderCard({ previewK: 6 });

    expect(screen.queryByTestId('dendrogram-preview-line')).not.toBeInTheDocument();
  });
});
