import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricCell, MetricSparkline } from './MetricCell';

const SERIES = [
  { k: 2, value: 0.15 },
  { k: 3, value: 0.25 },
  { k: 4, value: 0.2 },
  { k: 5, value: 0.35 },
];

describe('MetricCell', () => {
  it('shows the value in mono with three decimals', () => {
    render(<MetricCell value={0.9512} fraction={1} index={0} />);

    expect(screen.getByText('0.951')).toHaveClass('font-mono');
  });

  it('shows "no definido" for an undefined value', () => {
    render(<MetricCell value={null} fraction={0.04} index={0} />);

    expect(screen.getByText('no definido')).toBeInTheDocument();
  });

  it('draws the bar as an aria-hidden ink fill on a paper-sunken track, at the given fraction', () => {
    const { container } = render(<MetricCell value={0.5} fraction={0.5} index={0} />);

    const track = container.querySelector('[data-slot="metric-bar"]') as HTMLElement;
    expect(track).toHaveAttribute('aria-hidden', 'true');
    expect(track.className).toContain('bg-paper-sunken');
    expect(track.className).toContain('w-[72px]');
    const fill = track.firstElementChild as HTMLElement;
    expect(fill.className).toContain('bg-ink');
    expect(fill.className).toContain('enter-grow');
    expect(fill.style.width).toBe('50%');
  });

  it('staggers the bar growth by row index, capped at 12 rows', () => {
    const { container, rerender } = render(<MetricCell value={0.5} fraction={0.5} index={3} />);
    const fill = () =>
      container.querySelector('[data-slot="metric-bar"]')!.firstElementChild as HTMLElement;
    expect(fill().style.getPropertyValue('--i')).toBe('3');

    rerender(<MetricCell value={0.5} fraction={0.5} index={40} />);
    expect(fill().style.getPropertyValue('--i')).toBe('11');
  });

  it('draws no sparkline without a series', () => {
    const { container } = render(<MetricCell value={0.5} fraction={0.5} index={0} />);

    expect(container.querySelector('svg')).toBeNull();
  });

  it('adds a sparkline of the series after the bar', () => {
    const { container } = render(
      <MetricCell value={0.2} fraction={0.6} index={0} series={SERIES} activeK={4} />,
    );

    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('MetricSparkline', () => {
  it('is a 60 by 18 aria-hidden svg with a muted path and one point per k', () => {
    const { container } = render(<MetricSparkline series={SERIES} activeK={4} />);

    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toHaveAttribute('width', '60');
    expect(svg).toHaveAttribute('height', '18');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelector('path')!.getAttribute('class')).toContain('stroke-ink-muted');
    expect(container.querySelectorAll('circle')).toHaveLength(4);
  });

  it('draws the viewed k as the larger ink point and the others small and muted', () => {
    const { container } = render(<MetricSparkline series={SERIES} activeK={4} />);

    const circles = Array.from(container.querySelectorAll('circle'));
    const active = circles[2]!;
    expect(active.getAttribute('r')).toBe('2.5');
    expect(active.getAttribute('class')).toContain('fill-ink');
    expect(active.getAttribute('class')).not.toContain('fill-ink-muted');
    for (const index of [0, 1, 3]) {
      expect(circles[index]!.getAttribute('r')).toBe('1.25');
      expect(circles[index]!.getAttribute('class')).toContain('fill-ink-muted');
    }
  });

  it('moves the larger point when the viewed k changes', () => {
    const { container, rerender } = render(<MetricSparkline series={SERIES} activeK={4} />);
    rerender(<MetricSparkline series={SERIES} activeK={2} />);

    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles[0]!.getAttribute('r')).toBe('2.5');
    expect(circles[2]!.getAttribute('r')).toBe('1.25');
  });

  it('plots higher values higher (smaller y) inside the 18px box', () => {
    const { container } = render(<MetricSparkline series={SERIES} activeK={4} />);

    const ys = Array.from(container.querySelectorAll('circle')).map((c) =>
      Number(c.getAttribute('cy')),
    );
    // k=5 (0.35) is the highest value, k=2 (0.15) the lowest.
    expect(ys[3]).toBeLessThan(ys[0]!);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(18);
  });

  it('skips an undefined value on the line but still lists it in the hidden text', () => {
    const series = [
      { k: 2, value: 0.6 },
      { k: 3, value: null },
      { k: 4, value: 0.4 },
    ];
    const { container } = render(<MetricSparkline series={series} activeK={4} />);

    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(screen.getByText(/k = 3: no definido/)).toBeInTheDocument();
  });

  it('lists every k and its value in visually hidden text, so nothing depends on the drawing', () => {
    render(<MetricSparkline series={SERIES} activeK={4} />);

    const hidden = screen.getByText(/Valores por k/);
    expect(hidden).toHaveClass('sr-only');
    expect(hidden).toHaveTextContent(
      'Valores por k: k = 2: 0.150, k = 3: 0.250, k = 4: 0.200, k = 5: 0.350.',
    );
  });

  it('draws a lone point without dividing by zero, and a flat series mid-height', () => {
    const { container } = render(<MetricSparkline series={[{ k: 2, value: 0.3 }]} activeK={2} />);
    const circle = container.querySelector('circle')!;
    expect(Number(circle.getAttribute('cx'))).toBe(30);
    expect(Number.isFinite(Number(circle.getAttribute('cy')))).toBe(true);
  });
});
