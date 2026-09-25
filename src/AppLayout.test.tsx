import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import i18n from './infrastructure/i18n';
import { AppLayout } from './AppLayout';

afterEach(async () => {
  await i18n.changeLanguage('es');
});

function renderLayout(initialPath = '/similarity') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="similarity" element={<p>similarity page</p>} />
          <Route path="clustering" element={<p>clustering page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  it('renders the Legajo wordmark and exactly the three workbench sections', () => {
    renderLayout();

    expect(screen.getByRole('heading', { level: 1, name: 'Legajo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Similitud' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agrupamiento' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Benchmarks' })).toBeInTheDocument();
    // Corpus selection now lives in the selection rail, not as its own nav section.
    expect(screen.queryByRole('link', { name: 'Corpus' })).not.toBeInTheDocument();
  });

  it('marks the active section link with aria-current and the paper-sunken active fill', () => {
    renderLayout('/similarity');

    const activeLink = screen.getByRole('link', { name: 'Similitud' });
    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(activeLink.className).toContain('bg-paper-sunken');
    expect(screen.getByRole('link', { name: 'Agrupamiento' })).not.toHaveAttribute('aria-current');
  });

  it('renders the routed page content through the outlet', () => {
    renderLayout('/similarity');

    expect(screen.getByText('similarity page')).toBeInTheDocument();
  });

  it('switching the language updates a visible string without navigating', async () => {
    const user = userEvent.setup();
    renderLayout('/similarity');

    expect(screen.getByRole('link', { name: 'Similitud' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByRole('link', { name: 'Similarity' })).toBeInTheDocument();
    expect(screen.getByText('similarity page')).toBeInTheDocument();
  });

  it('names the language switch as a group so assistive technology announces it', () => {
    renderLayout();

    expect(screen.getByRole('group', { name: /idioma|language/i })).toBeInTheDocument();
  });

  it('gives the section nav links a 44px hit area on coarse pointers, keeping desktop density unchanged', () => {
    renderLayout();

    const link = screen.getByRole('link', { name: 'Similitud' });
    expect(link.className).toContain('pointer-coarse:min-w-11');
    expect(link.className).toContain('min-h-11');
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

  describe('the below-1024px menu button', () => {
    it('starts collapsed, with the nav hidden and a 44px accessible toggle', () => {
      renderLayout();

      const toggle = screen.getByRole('button', { name: 'Abrir navegación' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle.className).toContain('h-11');
      expect(toggle.className).toContain('w-11');
      expect(toggle).toHaveAttribute('aria-controls');

      const nav = screen.getByRole('navigation');
      expect(nav.getAttribute('id')).toBe(toggle.getAttribute('aria-controls'));
      expect(nav.className).toContain('hidden');
    });

    it('opens the nav list on click, each item at least 44px tall, and relabels the toggle', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));

      const toggle = screen.getByRole('button', { name: 'Cerrar navegación' });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const nav = screen.getByRole('navigation');
      expect(nav.className).toContain('flex');
      expect(nav.className).not.toContain('hidden');
      for (const name of ['Similitud', 'Agrupamiento', 'Benchmarks']) {
        expect(screen.getByRole('link', { name }).className).toContain('min-h-11');
      }
    });

    it('closes again once the route changes, e.g. after a nav link is activated', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));
      await user.click(screen.getByRole('link', { name: 'Agrupamiento' }));

      expect(await screen.findByText('clustering page')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });
});
