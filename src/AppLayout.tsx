import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router';

import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from './infrastructure/i18n';
import { cn } from './shared/lib/cn';

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
  // A link inside the collapsed mobile nav navigates without ever closing
  // the panel on its own (a route change is the only signal available from
  // a plain `NavLink` click), so the panel closes deterministically whenever
  // the route itself changes — adjusted during render (React's documented
  // pattern for resetting state when a prop/derived value changes) rather
  // than an effect, which would call `setNavOpen` after an already-committed
  // render and force a second, cascading one.
  const [openedForPathname, setOpenedForPathname] = useState(location.pathname);
  if (location.pathname !== openedForPathname) {
    setOpenedForPathname(location.pathname);
    setNavOpen(false);
  }

  // Native hash-navigation focus behavior is inconsistent across browsers
  // (Safari, notably, never moves focus on its own), so the skip link
  // manages focus explicitly instead of relying on it.
  const focusMainContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={focusMainContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:bg-ink focus:px-4 focus:py-2 focus:text-label focus:font-semibold focus:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('app.skipToContent')}
      </a>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-paper-raised px-4 sm:px-6">
        <h1 className="text-title font-semibold text-ink">{t('app.title')}</h1>

        <nav
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
        className="flex flex-1 flex-col gap-6 p-6 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus"
      >
        <Outlet />
      </main>
    </div>
  );
}
