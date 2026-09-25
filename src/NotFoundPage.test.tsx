import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { NotFoundPage } from './NotFoundPage';

function renderNotFound() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  );
}

describe('NotFoundPage', () => {
  it('renders the not-found title', () => {
    renderNotFound();

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });

  it('offers a primary, button-styled way back to the corpus', () => {
    renderNotFound();

    const cta = screen.getByRole('link', { name: 'Ir al corpus' });
    expect(cta).toHaveAttribute('href', '/corpus');
    // Primary variant chrome (ink fill), not a bare text link.
    expect(cta.className).toContain('bg-primary');
  });
});
