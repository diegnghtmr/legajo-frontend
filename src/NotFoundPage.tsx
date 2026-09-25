import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { buttonVariants } from './shared/components/ui/button';

/** Catch-all route for an unknown path, with a primary way back to a known screen. */
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-title font-semibold text-ink">{t('notFound.title')}</h2>
      <p className="text-body text-ink-secondary">{t('notFound.description')}</p>
      <div>
        <Link to="/corpus" className={buttonVariants({ variant: 'primary' })}>
          {t('notFound.cta')}
        </Link>
      </div>
    </div>
  );
}
