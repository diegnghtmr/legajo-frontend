import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { useIsAtLeastLg } from '../../shared/lib/useIsAtLeastLg';
import { WorkbenchLayout } from '../../shared/components/WorkbenchLayout';
import { Button } from '../../shared/components/ui/button';
import { Sheet, SheetContent } from '../../shared/components/ui/sheet';
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
 *
 * `WorkbenchLayout` hides its own `detail` region entirely below `lg`
 * (there is no room for a third, always-visible column next to the
 * results there) — below that breakpoint, the same detail content instead
 * opens as a full-height dialog (`Sheet`), and is never also passed to
 * `WorkbenchLayout`, so the two never coexist in the accessibility tree.
 */
export function SimilarityWorkbenchLayout() {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<DetailView>(null);
  const isAtLeastLg = useIsAtLeastLg();
  // The exact control that opened the currently-shown detail view (a rail
  // row's title, or the embeddings status row) — closing it returns focus
  // there instead of dropping it back to the document body, the same way
  // the app shell's own collapsible nav returns focus to its toggle button.
  const triggerRef = useRef<HTMLElement | null>(null);
  // Only an actual open→close transition returns focus, and only once the
  // close has actually committed: below `lg` the detail view is a Radix
  // `Dialog`, whose own focus trap is still active for the render where
  // `detail` first becomes `null` (Radix removes it from the DOM in that
  // same commit, but only *after* this component's own render). Calling
  // `focus()` synchronously inside the close handler — before that
  // happens — would fight the still-mounted trap and silently lose the
  // browser's focus outright; doing it here, in an effect that runs after
  // the commit, targets a document that no longer has anything trapping it.
  const wasOpenRef = useRef(false);

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
  }

  useEffect(() => {
    if (detail) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
      triggerRef.current = null;
    }
  }, [detail]);

  const detailContent =
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
    ) : null;

  return (
    <>
      <WorkbenchLayout
        rail={<SelectionRail onOpenAbstract={openAbstract} onOpenEmbeddings={openEmbeddings} />}
        detail={isAtLeastLg ? (detailContent ?? undefined) : undefined}
      >
        <Outlet />
      </WorkbenchLayout>
      {!isAtLeastLg && (
        <Sheet
          open={detail !== null}
          onOpenChange={(open) => {
            if (!open) {
              closeDetail();
            }
          }}
        >
          <SheetContent
            title={
              detail?.kind === 'abstract'
                ? t('corpus.detail.sheetTitle', { id: detail.id })
                : t('corpus.embeddingsStatus.title')
            }
          >
            {detailContent}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
