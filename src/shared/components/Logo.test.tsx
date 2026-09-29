import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Logo } from './Logo';

function renderLogo() {
  return render(
    <MemoryRouter>
      <Logo />
    </MemoryRouter>,
  );
}

describe('Logo', () => {
  it('is one home link whose accessible name is the lowercase wordmark', () => {
    renderLogo();

    const link = screen.getByRole('link', { name: 'legajo' });
    expect(link).toHaveAttribute('href', '/');
  });

  it('shows the 26px mark as a decorative image, so it adds nothing to the name', () => {
    const { container } = renderLogo();

    const mark = container.querySelector('img');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('src', '/logo-mark.svg');
    expect(mark).toHaveAttribute('alt', '');
    expect(mark).toHaveAttribute('width', '26');
    expect(mark).toHaveAttribute('height', '26');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('sets the wordmark as 20px semibold, lowercase, tight-tracked ink text', () => {
    renderLogo();

    const wordmark = screen.getByText('legajo');
    expect(wordmark.className).toContain('text-title');
    expect(wordmark.className).toContain('font-semibold');
    expect(wordmark.className).toContain('leading-none');
    expect(wordmark.className).toContain('tracking-[-0.03em]');
    expect(wordmark.className).toContain('text-ink');
  });

  it('keeps a 44px hit area on coarse pointers and the ink focus ring', () => {
    renderLogo();

    const link = screen.getByRole('link', { name: 'legajo' });
    expect(link.className).toContain('pointer-coarse:min-h-11');
    expect(link.className).toContain('focus-visible:outline-focus');
  });
});
