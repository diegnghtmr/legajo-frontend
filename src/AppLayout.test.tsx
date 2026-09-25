import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from './infrastructure/i18n';
import { AppLayout } from './AppLayout';
import {
  SHELL_HEADER_HEIGHT,
  SHELL_HEADER_HEIGHT_VAR,
  SHELL_MAIN_PADDING,
  SHELL_MAIN_PADDING_VAR,
} from './shared/lib/shellMetrics';

afterEach(async () => {
  await i18n.changeLanguage('es');
});

/** True when `className` contains `token` as its own whitespace-delimited
 * word — not merely as a substring (`toContain('flex')` would also match
 * `flex-col`, `lg:flex`, or the mobile menu button's own `lg:hidden`, so it
 * can never fail even for the wrong display value). */
function hasClassToken(element: HTMLElement, token: string): boolean {
  return element.className.split(/\s+/).includes(token);
}

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

  it("sets the shared header-height and main-padding custom properties on the shell's own root, the same tokens WorkbenchLayout reads back", () => {
    renderLayout();

    const root = screen.getByRole('heading', { level: 1, name: 'Legajo' }).closest('div');
    expect(root).not.toBeNull();
    expect(root?.style.getPropertyValue(SHELL_HEADER_HEIGHT_VAR)).toBe(SHELL_HEADER_HEIGHT);
    expect(root?.style.getPropertyValue(SHELL_MAIN_PADDING_VAR)).toBe(SHELL_MAIN_PADDING);
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
      expect(hasClassToken(nav, 'hidden')).toBe(true);
    });

    it('opens the nav list on click, each item at least 44px tall, and relabels the toggle', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));

      const toggle = screen.getByRole('button', { name: 'Cerrar navegación' });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const nav = screen.getByRole('navigation');
      // The real open/closed state: the exact class token, never a
      // substring (`lg:flex` is present in both states and would make
      // `toContain('flex')` pass even while still `hidden`).
      expect(hasClassToken(nav, 'flex')).toBe(true);
      expect(hasClassToken(nav, 'hidden')).toBe(false);
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
      expect(hasClassToken(screen.getByRole('navigation'), 'hidden')).toBe(true);
    });

    it("closes when the current (already active) route's own link is activated, which never changes the pathname", async () => {
      const user = userEvent.setup();
      renderLayout('/similarity');

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));
      await user.click(screen.getByRole('link', { name: 'Similitud' }));

      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(hasClassToken(screen.getByRole('navigation'), 'hidden')).toBe(true);
    });

    it('moves focus into the panel — onto its first link — when opened', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));

      expect(screen.getByRole('link', { name: 'Similitud' })).toHaveFocus();
    });

    it('returns focus to the menu button when closed via Escape', async () => {
      const user = userEvent.setup();
      renderLayout();

      const toggle = screen.getByRole('button', { name: 'Abrir navegación' });
      await user.click(toggle);
      expect(screen.getByRole('link', { name: 'Similitud' })).toHaveFocus();

      await user.keyboard('{Escape}');

      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(hasClassToken(screen.getByRole('navigation'), 'hidden')).toBe(true);
      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveFocus();
    });

    it('closes and returns focus to the menu button on an outside click', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));
      expect(screen.getByRole('link', { name: 'Similitud' })).toHaveFocus();

      // Outside both the panel and the toggle button.
      await user.click(screen.getByRole('heading', { level: 1, name: 'Legajo' }));

      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(hasClassToken(screen.getByRole('navigation'), 'hidden')).toBe(true);
      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveFocus();
    });

    it('a mousedown inside the open panel, on the nav itself rather than a link, is never treated as an outside click', async () => {
      const user = userEvent.setup();
      renderLayout('/clustering');

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));
      const nav = screen.getByRole('navigation');

      // The nav element itself is "inside the panel" per the
      // `navRef.current?.contains(target)` guard (it equals `navRef`), but
      // it is not a link, so this only exercises that guard, never a
      // link's own route-change close.
      fireEvent.mouseDown(nav);

      expect(screen.getByRole('button', { name: 'Cerrar navegación' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(hasClassToken(nav, 'hidden')).toBe(false);
    });

    it('lets an outside click reach its own target instead of swallowing its default action', async () => {
      const user = userEvent.setup();
      const handleOutsideClick = vi.fn();
      render(
        <MemoryRouter initialEntries={['/similarity']}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route
                path="similarity"
                element={
                  <button type="button" onClick={handleOutsideClick}>
                    Outside action
                  </button>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));
      expect(screen.getByRole('link', { name: 'Similitud' })).toHaveFocus();

      const outsideButton = screen.getByRole('button', { name: 'Outside action' });
      await user.click(outsideButton);

      // The click's default action (focus) and its own handler both still
      // fire — a preceding `preventDefault()` on the outside-click's
      // `mousedown` would silently swallow the first one.
      expect(outsideButton).toHaveFocus();
      expect(handleOutsideClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(hasClassToken(screen.getByRole('navigation'), 'hidden')).toBe(true);
    });

    it('closes and returns focus to the menu button on an outside click that lands on plain routed content', async () => {
      const user = userEvent.setup();
      renderLayout('/similarity');

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));
      expect(screen.getByRole('link', { name: 'Similitud' })).toHaveFocus();

      // The routed page content sits inside `<main tabIndex={-1}>` — a
      // click on its own plain text (never itself interactive) must still
      // be treated as an outside click on a non-focusable target, not as a
      // click on `main` itself just because `main` is the nearest ancestor
      // carrying a `tabindex` attribute.
      await user.click(screen.getByText('similarity page'));

      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(hasClassToken(screen.getByRole('navigation'), 'hidden')).toBe(true);
      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveFocus();
    });

    it('lets an outside click on a child of a focusable control focus that control', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/similarity']}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route
                path="similarity"
                element={
                  <button type="button">
                    <span>Outside label</span>
                  </button>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));
      await user.click(screen.getByText('Outside label'));

      expect(screen.getByRole('button', { name: 'Outside label' })).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });
});
