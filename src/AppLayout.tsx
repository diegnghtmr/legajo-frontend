import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router';

import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from './infrastructure/i18n';
import { cn } from './shared/lib/cn';
import { shellMetricsStyle } from './shared/lib/shellMetrics';

/** Each language's own name (autonym), so it reads the same in every locale. */
const LANGUAGE_AUTONYMS: Record<SupportedLanguage, string> = {
  es: 'Español',
  en: 'English',
};

function LanguageSwitch() {
  const { i18n, t } = useTranslation();

  return (
    <div role="group" className="flex items-center gap-1" aria-label={t('language.switchLabel')}>
      {SUPPORTED_LANGUAGES.map((language) => {
        const active = i18n.resolvedLanguage === language;
        return (
          <button
            key={language}
            type="button"
            lang={language}
            aria-pressed={active}
            onClick={() => void setLanguage(language)}
            className={cn(
              'rounded-btn px-2 py-1 text-label font-semibold',
              active ? 'bg-ink text-primary-foreground' : 'text-ink-secondary hover:text-ink',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              // Same 44px coarse-pointer hit area as the other primitives
              // (Button, Checkbox): desktop density (the visible px-2 py-1
              // box) is untouched, since `pointer-coarse:` only applies
              // under `@media (pointer: coarse)`.
              'pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center pointer-coarse:min-h-11 pointer-coarse:min-w-11',
            )}
          >
            {LANGUAGE_AUTONYMS[language]}
          </button>
        );
      })}
    </div>
  );
}

/** Nav items in the fixed order the shell always shows: the corpus
 * selection rail now carries article selection, so the top bar's own nav no
 * longer lists a separate "Corpus" section. */
const SECTIONS = [
  { to: '/similarity', labelKey: 'nav.similarity' },
  { to: '/clustering', labelKey: 'nav.clustering' },
  { to: '/benchmarks', labelKey: 'nav.benchmarks' },
] as const;

const MAIN_CONTENT_ID = 'main-content';
const PRIMARY_NAV_ID = 'primary-nav';

/** Whether `node` is, or sits inside, a real interactive focus target — the
 * browser's own default `mousedown` action would move focus onto that
 * control (or, for a link, activate it) once nothing prevents that default
 * action. A click on a control's label text or icon lands on a child node,
 * so the check walks up to the nearest focusable ancestor. A bare
 * `[tabindex]` excludes `tabindex="-1"`: that value marks a container that
 * is only ever focused programmatically (such as this shell's own `<main>`,
 * the skip link's target) and never by a plain click on its content, so
 * every routed page's own text would otherwise register as "focusable" for
 * simply living inside it. Used to decide, for an outside click that closes
 * the mobile nav, whether that click's own control should keep the focus it
 * is about to receive, instead of the panel's close handler yanking focus
 * back to its toggle button. */
function isFocusableElement(node: Node): boolean {
  if (!(node instanceof Element)) {
    return false;
  }
  return (
    node.closest(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable], summary, label, [tabindex]:not([tabindex="-1"])',
    ) !== null
  );
}

/**
 * App shell: a 56px top bar (wordmark, section nav, ES/EN switch) over the
 * routed page content through `Outlet`. Below the `lg` breakpoint (1024px)
 * the nav collapses behind a 44px menu button; above it,
 * the nav is always visible inline regardless of the button's own open/close
 * state (the `lg:flex` override in `navClassName` wins over the JS-driven
 * `hidden`/`flex` toggle), so this is one nav markup for every width, never
 * two duplicated link lists competing for the same accessible name.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  // Only actual open→close transitions return focus to the toggle button —
  // guarded so the very first render (already closed) never steals focus.
  const wasNavOpenRef = useRef(false);
  // Whether the *next* close should send focus back to the toggle button.
  // Escape and an outside click on a non-focusable target both opt in (the
  // panel is going away and nothing else claims focus); a link activation,
  // a route change, or an outside click on something itself focusable never
  // do, so that click's own default action — moving focus onto it — is
  // left alone instead of being overridden a moment later.
  const returnFocusToToggleRef = useRef(false);

  // A link inside the collapsed mobile nav navigates without ever closing
  // the panel on its own (a route change is the only signal available from
  // a plain `NavLink` click), so the panel closes deterministically whenever
  // the route itself changes — adjusted during render (React's documented
  // pattern for resetting state when a prop/derived value changes) rather
  // than an effect, which would call `setNavOpen` after an already-committed
  // render and force a second, cascading one. This alone misses a link to
  // the *current* route (its own `onClick` below covers that: a same-route
  // click never changes `location.pathname`, so this check alone would
  // never fire for it).
  const [openedForPathname, setOpenedForPathname] = useState(location.pathname);
  if (location.pathname !== openedForPathname) {
    setOpenedForPathname(location.pathname);
    setNavOpen(false);
  }

  // Panel open: move focus onto its first link. Panel close (any path —
  // Escape, an outside click, a link activation, the toggle itself, or the
  // route-change check above): return focus to the toggle button, so the
  // control that owns the panel's open state is where keyboard focus lands
  // next either way.
  useEffect(() => {
    if (navOpen) {
      wasNavOpenRef.current = true;
      // Reset for this open cycle; only Escape or an outside click on a
      // non-focusable target opts back in below.
      returnFocusToToggleRef.current = false;
      navRef.current?.querySelector<HTMLElement>('a')?.focus();
    } else if (wasNavOpenRef.current) {
      wasNavOpenRef.current = false;
      if (returnFocusToToggleRef.current) {
        toggleButtonRef.current?.focus();
      }
    }
  }, [navOpen]);

  // Escape and an outside click both close the panel; only wired up while
  // it is actually open. `mousedown` (not `click`) so the panel closes
  // before a click on unrelated page content also activates that content.
  useEffect(() => {
    if (!navOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        returnFocusToToggleRef.current = true;
        setNavOpen(false);
      }
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (navRef.current?.contains(target) || toggleButtonRef.current?.contains(target)) {
        return;
      }
      const targetIsFocusable = isFocusableElement(target);
      if (!targetIsFocusable) {
        // The target itself has nothing to gain focus/activate — this
        // suppresses the browser's own "blur to nothing" default action
        // for a mousedown that lands on nothing interactive, so the close
        // effect below can move focus to the toggle button deterministically
        // instead of it landing on neither. A *focusable* target never hits
        // this branch: its own default action (moving focus onto it, or a
        // button/link's own click) is left alone instead of being
        // overridden a moment later.
        event.preventDefault();
      }
      returnFocusToToggleRef.current = !targetIsFocusable;
      setNavOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [navOpen]);

  // Native hash-navigation focus behavior is inconsistent across browsers
  // (Safari, notably, never moves focus on its own), so the skip link
  // manages focus explicitly instead of relying on it.
  const focusMainContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink" style={shellMetricsStyle}>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={focusMainContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:bg-ink focus:px-4 focus:py-2 focus:text-label focus:font-semibold focus:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('app.skipToContent')}
      </a>
      <header className="sticky top-0 z-30 flex h-(--shell-header-h) shrink-0 items-center gap-3 border-b border-hairline bg-paper-raised px-4 sm:px-6">
        <h1 className="text-title font-semibold text-ink">{t('app.title')}</h1>

        <nav
          ref={navRef}
          id={PRIMARY_NAV_ID}
          aria-label={t('app.eyebrow')}
          className={cn(
            'absolute inset-x-0 top-full flex-col gap-1 border-b border-hairline bg-paper-raised p-2 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]',
            'lg:static lg:flex lg:flex-row lg:items-center lg:gap-1 lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none',
            navOpen ? 'flex' : 'hidden',
          )}
        >
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              // A link to the *current* route never changes
              // `location.pathname`, so the render-time check above alone
              // would never close the panel for it — this closes
              // unconditionally on every link activation instead, whether
              // or not the destination differs.
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center rounded-btn px-3 text-label font-semibold lg:min-h-0 lg:px-3 lg:py-1.5',
                  isActive ? 'bg-paper-sunken text-ink' : 'text-ink-secondary hover:text-ink',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  'pointer-coarse:min-w-11',
                )
              }
            >
              {t(section.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            ref={toggleButtonRef}
            type="button"
            aria-expanded={navOpen}
            aria-controls={PRIMARY_NAV_ID}
            aria-label={navOpen ? t('app.nav.closeLabel') : t('app.nav.openLabel')}
            onClick={() => setNavOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-btn text-ink hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
          >
            {navOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
          <LanguageSwitch />
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        ref={mainRef}
        tabIndex={-1}
        className="flex flex-1 flex-col gap-6 p-(--shell-main-pad) focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus"
      >
        <Outlet />
      </main>
    </div>
  );
}
