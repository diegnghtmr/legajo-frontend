import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Spanish is the default: neither PRD RNF-11 nor TRD §6.7 fixes a default
 * language, only that both are supported and the switch works (TAC-16); the
 * course, the PRD/TRD/DESIGN.md documents and the author are Spanish, so
 * this task defaults to `es` and records the decision here.
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    // React already escapes rendered text; double-escaping would corrupt it.
    escapeValue: false,
  },
});

/** Runtime language switch (TAC-16); components read the active language via `useTranslation`. */
export function setLanguage(language: SupportedLanguage): Promise<unknown> {
  return i18n.changeLanguage(language);
}

export default i18n;
