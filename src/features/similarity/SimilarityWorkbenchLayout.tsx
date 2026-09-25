import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { WorkbenchLayout } from '../../shared/components/WorkbenchLayout';
import { Button } from '../../shared/components/ui/button';
import { ArticleAbstract } from '../corpus/ArticleAbstract';
import { EmbeddingsStatusPanel } from '../corpus/EmbeddingsStatusPanel';
import { SelectionRail } from '../corpus/SelectionRail';

type DetailView = { kind: 'abstract'; id: string } | { kind: 'embeddings' } | null;

/**
 * Layout route for the similarity screens (compare, matrix, trace): the
 * persistent selection rail on the left, the routed screen's own results in
 * the center, and — once a rail row's title or the embeddings status line is
 * activated — the abstract or the embeddings detail on the right. Only one
 * detail view is open at a time; opening one replaces the other.
 */
export function SimilarityWorkbenchLayout() {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<DetailView>(null);
  // The exact control that opened the currently-shown detail view (a rail
  // row's title, or the embeddings status row) — closing it returns focus
  // there instead of dropping it back to the document body, the same way
  // the app shell's own collapsible nav returns focus to its toggle button.
  const triggerRef = useRef<HTMLElement | null>(null);

  function openAbstract(id: string) {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setDetail({ kind: 'abstract', id });
  }

  function openEmbeddings() {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setDetail({ kind: 'embeddings' });
  }

  function closeDetail() {
    setDetail(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }

  return (
    <WorkbenchLayout
      rail={<SelectionRail onOpenAbstract={openAbstract} onOpenEmbeddings={openEmbeddings} />}
      detail={
        detail?.kind === 'abstract' ? (
          <ArticleAbstract id={detail.id} onClose={closeDetail} />
        ) : detail?.kind === 'embeddings' ? (
          <div className="flex h-full flex-col gap-4 p-4">
            <div className="flex justify-end">
              <Button variant="secondary" onClick={closeDetail}>
                {t('corpus.detail.closeLabel')}
              </Button>
            </div>
            <EmbeddingsStatusPanel />
          </div>
        ) : undefined
      }
    >
      <Outlet />
    </WorkbenchLayout>
  );
}
