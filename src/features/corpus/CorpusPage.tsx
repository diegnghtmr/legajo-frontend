import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { PanelHeader } from '../../shared/components/Panel';
import { ArticleList } from './ArticleList';
import { CompareCta } from './CompareCta';

/**
 * Corpus / selection screen (DESIGN.md §6.1): a list of abstracts on the
 * left (desktop) or top (narrow) with the sticky compare CTA, and the
 * selected article's full abstract on the right via the nested route
 * (`CorpusDetailPlaceholder` or `CorpusDetail`, rendered through `Outlet`).
 */
export function CorpusPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <section className="flex flex-1 flex-col gap-4">
        <PanelHeader eyebrow={t('corpus.eyebrow')} title={t('corpus.title')} />
        <ArticleList />
        <CompareCta />
      </section>
      <section className="flex-1">
        <Outlet />
      </section>
    </div>
  );
}
