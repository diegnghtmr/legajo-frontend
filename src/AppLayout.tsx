import { useRef } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';

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

const SECTIONS = [
  { to: '/corpus', labelKey: 'nav.corpus' },
  { to: '/similarity', labelKey: 'nav.similarity' },
  { to: '/clustering', labelKey: 'nav.clustering' },
  { to: '/benchmarks', labelKey: 'nav.benchmarks' },
] as const;

/**
 * App shell: header + section navigation + language switch, and the routed
 * page content through `Outlet`. Section links use `NavLink` so the active
 * route gets `aria-current="page"` for free.
 */
const MAIN_CONTENT_ID = 'main-content';

export function AppLayout() {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);

  // Native hash-navigation focus behavior is inconsistent across browsers
  // (Safari, notably, never moves focus on its own), so the skip link
  // manages focus explicitly instead of relying on it.
  const focusMainContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={focusMainContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:bg-ink focus:px-4 focus:py-2 focus:text-label focus:font-semibold focus:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('app.skipToContent')}
      </a>
      <header className="flex flex-col gap-4 border-b border-hairline bg-paper-raised px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
            {t('app.eyebrow')}
          </p>
          <h1 className="text-display font-semibold tracking-tight text-ink">{t('app.title')}</h1>
        </div>
        <nav aria-label={t('app.eyebrow')} className="flex items-center gap-4">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              className={({ isActive }) =>
                cn(
                  'text-body font-semibold',
                  isActive ? 'text-ink underline underline-offset-4' : 'text-ink-secondary',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  // Same 44px coarse-pointer hit area as the other
                  // primitives (Button, Checkbox); desktop density (the
                  // plain inline link) is untouched.
                  'pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center pointer-coarse:min-h-11 pointer-coarse:min-w-11',
                )
              }
            >
              {t(section.labelKey)}
            </NavLink>
          ))}
        </nav>
        <LanguageSwitch />
      </header>
      <main
        id={MAIN_CONTENT_ID}
        ref={mainRef}
        tabIndex={-1}
        className="flex flex-col gap-6 p-6 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus"
      >
        <Outlet />
      </main>
    </div>
  );
}
