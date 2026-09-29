import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Spanish is the default: no requirement fixes a default
 * language, only that both are supported and the switch works; the
 * course and the author are Spanish, so
 * this defaults to `es` and records the decision here.
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

/**
 * The document language follows the active language, so assistive
 * technology pronounces the page in the language it is written in.
 */
function syncDocumentLanguage(language: string): void {
  document.documentElement.lang = language;
}
i18n.on('languageChanged', syncDocumentLanguage);
syncDocumentLanguage(i18n.language);

/** Runtime language switch; components read the active language via `useTranslation`. */
export function setLanguage(language: SupportedLanguage): Promise<unknown> {
  return i18n.changeLanguage(language);
}

export default i18n;
