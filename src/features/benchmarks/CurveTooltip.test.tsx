import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FamilySeries } from './grouping';
import { CurveTooltip } from './CurveTooltip';
import { errorKey } from './plotModel';

const SERIES: FamilySeries[] = [
  { family: 'levenshtein', points: [{ size: 50, valueNs: 7_900, errorNs: 400 }] },
  { family: 'jaccard', points: [{ size: 50, valueNs: 4_500, errorNs: 0 }] },
  { family: 'tfidf-cosine', points: [] },
];

const ROW = {
  size: 50,
  levenshtein: 7_900,
  jaccard: 4_500,
  [errorKey('levenshtein')]: [400, 400] as const,
};

function renderTooltip(overrides: Partial<Parameters<typeof CurveTooltip>[0]> = {}) {
  return render(
    <CurveTooltip
      row={ROW}
      series={SERIES}
      xAxisLabel="Longitud de secuencia (L)"
      isolatedFamily={null}
      {...overrides}
    />,
  );
}

describe('CurveTooltip', () => {
  it('renders nothing while no size is hovered or focused', () => {
    const { container } = renderTooltip({ row: undefined });

    expect(container).toBeEmptyDOMElement();
  });

  it('names the hovered size under the x-axis title', () => {
    renderTooltip();

    const tooltip = screen.getByRole('tooltip');
    expect(within(tooltip).getByText('Longitud de secuencia (L)')).toBeInTheDocument();
    expect(within(tooltip).getByText('50')).toBeInTheDocument();
  });

  it('lists every series measured at that size by its mono id, with its duration', () => {
    renderTooltip();

    const tooltip = screen.getByRole('tooltip');
    const levenshtein = within(tooltip).getByText('levenshtein');
    expect(levenshtein.closest('[data-family]')?.className).toContain('font-mono');
    expect(within(tooltip).getByText('7.9 µs')).toBeInTheDocument();
    expect(within(tooltip).getByText('jaccard')).toBeInTheDocument();
    expect(within(tooltip).getByText('4.5 µs')).toBeInTheDocument();
  });

  it('omits a series with no measurement at that size instead of inventing one', () => {
    renderTooltip();

    expect(screen.queryByText('tfidf-cosine')).not.toBeInTheDocument();
  });

  it('shows the ± JMH error next to the duration, and only when the point reports one', () => {
    renderTooltip();

    expect(screen.getByText('± 400 ns')).toBeInTheDocument();
    expect(screen.getAllByText(/±/)).toHaveLength(1);
  });

  it('samples each series in its own hue, in series order', () => {
    renderTooltip();

    expect(screen.getByTestId('tooltip-hue-levenshtein')).toHaveStyle({
      background: 'var(--color-cluster-1)',
    });
    expect(screen.getByTestId('tooltip-hue-jaccard')).toHaveStyle({
      background: 'var(--color-cluster-2)',
    });
  });

  it('never captures the pointer, so it cannot cover what the reader hovers', () => {
    renderTooltip();

    expect(screen.getByRole('tooltip').className).toContain('pointer-events-none');
  });

  it('recedes the series that are not isolated', () => {
    renderTooltip({ isolatedFamily: 'jaccard' });

    const levenshteinRow = screen.getByText('levenshtein').closest('[data-family]');
    const jaccardRow = screen.getByText('jaccard').closest('[data-family]');
    expect(levenshteinRow).toHaveStyle({ opacity: '0.4' });
    expect(jaccardRow).toHaveStyle({ opacity: '1' });
  });
});
