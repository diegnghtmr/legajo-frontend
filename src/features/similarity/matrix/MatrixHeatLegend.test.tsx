import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MatrixHeatLegend } from './MatrixHeatLegend';
import { MATRIX_HEAT_BUCKETS, matrixHeatClassName } from './matrixHeat';

describe('MatrixHeatLegend', () => {
  it('lists the four heat buckets with their mono range labels', () => {
    render(<MatrixHeatLegend />);

    const items = within(screen.getByRole('list', { name: 'Escala de color' })).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.textContent)).toEqual([
      '< 0.25',
      '0.25–0.5',
      '0.5–0.75',
      '≥ 0.75',
    ]);
    for (const item of items) {
      expect(item.querySelector('.font-mono')).not.toBeNull();
    }
  });

  it('draws each swatch with the class a cell of that bucket gets, and hides it from assistive technology', () => {
    render(<MatrixHeatLegend />);

    const swatches = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('[data-swatch]') as HTMLElement);
    MATRIX_HEAT_BUCKETS.forEach((bucket, index) => {
      const cellClasses = matrixHeatClassName(bucket.lowerBound).split(' ');
      for (const className of cellClasses.filter((name) => name.startsWith('bg-'))) {
        expect(swatches[index]).toHaveClass(className);
      }
      expect(swatches[index]).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
