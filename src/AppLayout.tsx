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
export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-paper text-ink">
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
                )
              }
            >
              {t(section.labelKey)}
            </NavLink>
          ))}
        </nav>
        <LanguageSwitch />
      </header>
      <main className="flex flex-col gap-6 p-6">
        <Outlet />
      </main>
    </div>
  );
}
