import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { PanelHeader } from '../../shared/components/Panel';
import { ArticleList } from './ArticleList';
import { CompareCta } from './CompareCta';
import { EmbeddingsStatusPanel } from './EmbeddingsStatusPanel';
import { MatrixCta } from './MatrixCta';

/**
 * Corpus / selection screen: a list of abstracts on the
 * left (desktop) or top (narrow) with the sticky compare/matrix CTA bar, and
 * the selected article's full abstract on the right via the nested route
 * (`CorpusDetailPlaceholder` or `CorpusDetail`, rendered through `Outlet`).
 *
 * The CTA bar is `position: sticky` at the bottom of this column (mobile:
 * top list, sticky bottom, since narrow layouts stay `flex-col`) so both
 * actions stay reachable while scrolling a long article list, on desktop
 * and mobile alike: it keeps its own slot in the normal document flow (it
 * never covers content the way a `fixed` bar would), so `pb-24` under the
 * list is only there to give the list's own last rows room to clear the bar
 * before it un-sticks, not to work around any overlap from the bar itself.
 */
export function CorpusPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <section className="flex flex-1 flex-col gap-4">
        <PanelHeader eyebrow={t('corpus.eyebrow')} title={t('corpus.title')} />
        <div className="pb-24">
          <ArticleList />
        </div>
        <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-hairline bg-paper py-3">
          <CompareCta />
          <MatrixCta />
        </div>
        <EmbeddingsStatusPanel />
      </section>
      <section className="flex-1">
        <Outlet />
      </section>
    </div>
  );
}
