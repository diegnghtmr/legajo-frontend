import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormulaCaption } from './FormulaCaption';

describe('FormulaCaption', () => {
  it('renders the caption text and, once the lazy KaTeX chunk resolves, a KaTeX formula', async () => {
    const { container } = render(
      <FormulaCaption tex="a^2+b^2=c^2" caption="Pythagorean theorem" />,
    );

    expect(await screen.findByText('Pythagorean theorem')).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector('.katex')).not.toBeNull();
    });
  });

  it('keeps a wide formula inside its own focusable, labelled scroll region named by the caption', async () => {
    render(<FormulaCaption tex="a^2+b^2=c^2" caption="Pythagorean theorem" />);

    const region = await screen.findByRole('region', { name: 'Pythagorean theorem' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('overflow-x-auto', 'max-w-full');
    await waitFor(() => {
      expect(region.querySelector('.katex')).not.toBeNull();
    });
  });
});
