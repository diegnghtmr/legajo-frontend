import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { slopePosition, SlopeStrip, SlopeStripSkeleton } from './SlopeStrip';

const FAMILIES = ['levenshtein', 'needleman-wunsch', 'jaccard'];
const SLOPES = new Map([
  ['levenshtein', { empiricalSlope: 2.04, theoreticalExponent: 2 }],
  ['jaccard', { empiricalSlope: 4.2, theoreticalExponent: 1 }],
]);

function renderStrip() {
  return render(<SlopeStrip families={FAMILIES} slopes={SLOPES} caption="Pendiente: pares" />);
}

describe('slopePosition', () => {
  it('places a value on the 0 to 3.5 axis as a fraction of its length', () => {
    expect(slopePosition(0)).toBe(0);
    expect(slopePosition(1.75)).toBe(0.5);
    expect(slopePosition(3.5)).toBe(1);
  });

  it('pins a value beyond the axis end to the end, and one below zero to the start', () => {
    expect(slopePosition(4.2)).toBe(1);
    expect(slopePosition(-0.3)).toBe(0);
  });
});

describe('SlopeStrip', () => {
  it('lists one row per series that has a slope, naming it by its mono id with its hue swatch', () => {
    renderStrip();

    const table = screen.getByRole('table', { name: 'Pendiente: pares' });
    // header + levenshtein + jaccard (needleman-wunsch has no slope entry)
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).queryByText('needleman-wunsch')).not.toBeInTheDocument();
    expect(within(table).getByText('levenshtein').className).toContain('font-mono');
  });

  it('keeps each series the hue of its position in the chart, not in the filtered list', () => {
    renderStrip();

    expect(screen.getByTestId('slope-swatch-levenshtein')).toHaveStyle({
      background: 'var(--color-cluster-1)',
    });
    // jaccard is the chart's third series even though the second slope row.
    expect(screen.getByTestId('slope-swatch-jaccard')).toHaveStyle({
      background: 'var(--color-cluster-3)',
    });
  });

  it('states both values exactly, in mono, as the text equivalent of the strip', () => {
    renderStrip();

    const table = screen.getByRole('table', { name: 'Pendiente: pares' });
    const empirical = within(table).getByText('2.04');
    const theoretical = within(table).getByText('2.00');
    expect(empirical.className).toContain('font-mono');
    expect(empirical.className).toContain('text-ink');
    expect(theoretical.className).toContain('text-ink-muted');
    // The pinned dot still reports its exact value.
    expect(within(table).getByText('4.20')).toBeInTheDocument();
  });

  it('draws the empirical dot in the series hue and the theoretical exponent as an ink tick', () => {
    renderStrip();

    const dot = screen.getByTestId('slope-dot-levenshtein');
    const tick = screen.getByTestId('slope-tick-levenshtein');
    expect(dot).toHaveStyle({ background: 'var(--color-cluster-1)' });
    expect(dot.style.left).toBe(`${(2.04 / 3.5) * 100}%`);
    expect(tick.className).toContain('bg-ink');
    expect(tick.style.left).toBe(`${(2 / 3.5) * 100}%`);
  });

  it('pins a dot beyond the axis end to the end of the strip', () => {
    renderStrip();

    expect(screen.getByTestId('slope-dot-jaccard').style.left).toBe('100%');
  });

  it('joins the two marks with a faint segment in the series hue', () => {
    renderStrip();

    const segment = screen.getByTestId('slope-segment-levenshtein');
    expect(segment).toHaveStyle({ background: 'var(--color-cluster-1)', opacity: '0.35' });
    expect(segment.style.left).toBe(`${(2 / 3.5) * 100}%`);
    expect(segment.style.width).toMatch(/^1\.14/);
  });

  it('hides the drawn strip from assistive tech, since both values are stated as text', () => {
    renderStrip();

    expect(
      screen.getByTestId('slope-dot-levenshtein').closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it('names the dot and the tick in a two-item key with no separator glyph', () => {
    renderStrip();

    const key = screen.getByRole('list', { name: 'Clave de la tira de pendientes' });
    expect(within(key).getAllByRole('listitem')).toHaveLength(2);
    expect(within(key).getByText('Pendiente empírica')).toBeInTheDocument();
    expect(within(key).getByText('Exponente teórico')).toBeInTheDocument();
    expect(key.textContent).not.toContain('·');
  });

  it('puts the wide table in its one focusable scroll region', () => {
    renderStrip();

    const region = screen.getByRole('region', { name: 'Pendiente: pares' });
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('renders nothing when no series has a slope', () => {
    const { container } = render(
      <SlopeStrip families={FAMILIES} slopes={new Map()} caption="vacío" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('SlopeStripSkeleton', () => {
  it('mirrors the header, the key and one row per known family, with real ids', () => {
    render(<SlopeStripSkeleton families={FAMILIES} caption="Pendiente: pares" />);

    const table = screen.getByRole('table', { name: 'Pendiente: pares' });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + FAMILIES.length);
    expect(within(table).getByText('needleman-wunsch')).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Clave de la tira de pendientes' }),
    ).toBeInTheDocument();
  });

  it('is not a scroll region and holds no focusable element', () => {
    const { container } = render(<SlopeStripSkeleton families={FAMILIES} caption="x" />);

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0);
  });
});
