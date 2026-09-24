import { describe, expect, it } from 'vitest';

import i18n, { DEFAULT_LANGUAGE, setLanguage, SUPPORTED_LANGUAGES } from './index';

describe('i18n setup', () => {
  it('defaults to Spanish (the course language; no default is otherwise specified)', () => {
    expect(DEFAULT_LANGUAGE).toBe('es');
    expect(i18n.language).toBe('es');
  });

  it('supports exactly Spanish and English', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['es', 'en']);
  });

  it('resolves a key in the default language', () => {
    expect(i18n.t('app.title')).toBe('Legajo');
    expect(i18n.t('app.eyebrow')).toBe('Banco de similitud y agrupamiento');
  });

  it('switches language at runtime via setLanguage', async () => {
    await setLanguage('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('app.eyebrow')).toBe('Similarity and clustering workbench');

    await setLanguage('es');
    expect(i18n.language).toBe('es');
  });
});
