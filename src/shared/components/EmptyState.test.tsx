import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title and the reason as plain text', () => {
    render(<EmptyState title="Sin resultados" reason="Selecciona al menos 2 artículos." />);

    expect(screen.getByText('Sin resultados').className).toContain('font-medium');
    expect(screen.getByText('Selecciona al menos 2 artículos.').className).toContain(
      'text-ink-muted',
    );
  });

  it('draws a hatched hairline well with the card radius', () => {
    const { container } = render(<EmptyState title="Title" />);

    const root = container.firstElementChild;
    expect(root?.className).toContain('rounded-md');
    expect(root?.className).toContain('repeating-linear-gradient(135deg');
    expect(root?.className).toContain('var(--color-hairline)');
  });

  it('hides the mono glyph line from assistive technology', () => {
    render(<EmptyState glyph="2 → pares / 3+ → matriz" title="Title" />);

    const glyph = screen.getByText('2 → pares / 3+ → matriz');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(glyph.className).toContain('font-mono');
  });

  it('omits the glyph and the reason when not given', () => {
    const { container } = render(<EmptyState title="Title" />);

    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('places an optional action after the text', () => {
    render(<EmptyState title="Title" action={<a href="/similarity">Ir a Similitud</a>} />);

    expect(screen.getByRole('link', { name: 'Ir a Similitud' })).toBeInTheDocument();
  });

  it('renders the title as a heading of the requested level', () => {
    render(<EmptyState title="Página no encontrada" headingLevel={2} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Página no encontrada' })).toBeVisible();
  });

  it('is not interactive itself and forwards role and other props', () => {
    render(<EmptyState title="Title" role="status" data-testid="empty" />);

    expect(screen.getByRole('status')).toBe(screen.getByTestId('empty'));
  });
});
