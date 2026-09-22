import { useTranslation } from 'react-i18next';

/** Catch-all route for an unknown path. */
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-title font-semibold text-ink">{t('notFound.title')}</h2>
      <p className="text-body text-ink-secondary">{t('notFound.description')}</p>
    </div>
  );
}
