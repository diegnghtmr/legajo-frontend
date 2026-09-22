import { useTranslation } from 'react-i18next';

/** Right-panel prompt shown at `/corpus` before any article is selected. */
export function CorpusDetailPlaceholder() {
  const { t } = useTranslation();

  return <p className="text-body text-ink-secondary">{t('corpus.detail.selectPrompt')}</p>;
}
