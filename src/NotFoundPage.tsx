import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { EmptyState } from './shared/components/EmptyState';
import { buttonVariants } from './shared/components/ui/button';

/** Catch-all route for an unknown path, with a primary way back to a known screen. */
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <EmptyState
      glyph="404"
      headingLevel={2}
      title={t('notFound.title')}
      reason={t('notFound.description')}
      action={
        // The top bar has no separate "Corpus" section any more — this
        // names, and goes straight to, the screen it actually opens
        // (`/similarity`), never the old `/corpus` alias that only
        // redirects onward from here.
        <Link to="/similarity" className={buttonVariants({ variant: 'primary' })}>
          {t('notFound.cta')}
        </Link>
      }
    />
  );
}
