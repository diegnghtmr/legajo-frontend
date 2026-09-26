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

  it('offers a primary, button-styled way to the similarity screen, named after the section it actually opens', () => {
    renderNotFound();

    // Never "Ir al corpus": the top bar has no "Corpus" section any more,
    // and that label used to name a route (`/corpus`) that itself only
    // ever redirects onward — the label now names the actual destination.
    const cta = screen.getByRole('link', { name: 'Ir a Similitud' });
    expect(cta).toHaveAttribute('href', '/similarity');
    // Primary variant chrome (ink fill), not a bare text link.
    expect(cta.className).toContain('bg-primary');
  });
});
