import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import i18n from './infrastructure/i18n';
import { AppLayout } from './AppLayout';

afterEach(async () => {
  await i18n.changeLanguage('es');
});

function renderLayout(initialPath = '/corpus') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="corpus" element={<p>corpus page</p>} />
          <Route path="similarity" element={<p>similarity page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  it('renders the Legajo heading and the section navigation', () => {
    renderLayout();

    expect(screen.getByRole('heading', { level: 1, name: /legajo/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Corpus' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Similitud' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agrupamiento' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Benchmarks' })).toBeInTheDocument();
  });

  it('marks the active section link with aria-current', () => {
    renderLayout('/corpus');

    expect(screen.getByRole('link', { name: 'Corpus' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Similitud' })).not.toHaveAttribute('aria-current');
  });

  it('renders the routed page content through the outlet', () => {
    renderLayout('/corpus');

    expect(screen.getByText('corpus page')).toBeInTheDocument();
  });

  it('switching the language updates a visible string without navigating', async () => {
    const user = userEvent.setup();
    renderLayout('/corpus');

    expect(screen.getByRole('link', { name: 'Corpus' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByRole('link', { name: 'Similarity' })).toBeInTheDocument();
    expect(screen.getByText('corpus page')).toBeInTheDocument();
  });
  it('names the language switch as a group so assistive technology announces it', () => {
    renderLayout();

    expect(screen.getByRole('group', { name: /idioma|language/i })).toBeInTheDocument();
  });

  it('gives the section nav links a 44px hit area on coarse pointers, keeping desktop density unchanged', () => {
    renderLayout();

    const link = screen.getByRole('link', { name: 'Corpus' });
    expect(link.className).toContain('pointer-coarse:min-h-11');
    expect(link.className).toContain('pointer-coarse:min-w-11');
  });

  it('gives the language-switch buttons a 44px hit area on coarse pointers', () => {
    renderLayout();

    const button = screen.getByRole('button', { name: 'English' });
    expect(button.className).toContain('pointer-coarse:min-h-11');
    expect(button.className).toContain('pointer-coarse:min-w-11');
  });

  it('provides a skip-to-content link as the first focusable element, hidden until focused', () => {
    renderLayout();

    const skipLink = screen.getByRole('link', { name: 'Saltar al contenido' });
    expect(skipLink.className).toContain('sr-only');
    expect(skipLink.className).toContain('focus:not-sr-only');
  });

  it('moves focus to the main content when the skip link is activated after a first Tab', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(screen.getByRole('main')).toHaveFocus();
  });
});
