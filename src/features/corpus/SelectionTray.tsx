import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../shared/components/ui/button';
import { Sheet, SheetContent } from '../../shared/components/ui/sheet';
import { CorpusListPanel } from './CorpusListPanel';
import { useSelectionStore } from './selectionStore';
import { useAdaptiveSelectionCta } from './useAdaptiveSelectionCta';

/** How many selected mono ids the tray's own summary line shows before
 * collapsing the rest into a "+N" overflow marker. Not a rule DESIGN.md
 * fixes to a specific number — a conservative, deterministic choice so the
 * summary line stays short and predictable at the 390px reference width
 * regardless of how many articles are selected; sorted rather than the raw
 * toggle order, so the visible ids and the "+N" count never reorder
 * themselves as more articles are toggled. */
const MAX_VISIBLE_IDS = 3;

export interface SelectionTrayProps {
  onOpenAbstract: (id: string) => void;
  onOpenEmbeddings: () => void;
  /** Called the instant the CTA is activated, in addition to (never
   * instead of) its own navigation — never on a mere selection change.
   * `SimilarityWorkbenchLayout` uses this to know a comparison was
   * explicitly confirmed, as distinct from a pair merely existing, so
   * selecting a second article alone never swaps its own main content out
   * from under the person mid-tap (DESIGN §6.7: select, select, compare is
   * three interactions, not two). */
  onCtaActivate?: () => void;
}

/**
 * The rail's below-`lg` replacement (DESIGN §6.1, §6.7): docked at the
 * bottom, `paper-raised` with a hairline top border and safe-area bottom
 * padding. Its own summary line (the selected count and mono ids) opens the
 * full corpus list as a bottom sheet on tap — reusing `CorpusListPanel`
 * verbatim, never a second copy of the rail's rows — while the same
 * adaptive CTA `SelectionRail` uses (`useAdaptiveSelectionCta`) stays
 * pinned below it, full width, so activating it is never confused with
 * opening the list.
 */
export function SelectionTray({
  onOpenAbstract,
  onOpenEmbeddings,
  onCtaActivate,
}: SelectionTrayProps) {
  const { t } = useTranslation();
  const [listOpen, setListOpen] = useState(false);
  const reasonId = useId();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const { selectedCount, ctaLabel, ctaEnabled, modeText, onCtaClick } = useAdaptiveSelectionCta();

  const sortedIds = [...selectedIds].sort();
  const visibleIds = sortedIds.slice(0, MAX_VISIBLE_IDS);
  const overflowCount = sortedIds.length - visibleIds.length;

  function handleCtaClick() {
    onCtaActivate?.();
    setListOpen(false);
    onCtaClick();
  }

  function handleOpenAbstract(id: string) {
    setListOpen(false);
    onOpenAbstract(id);
  }

  function handleOpenEmbeddings() {
    setListOpen(false);
    onOpenEmbeddings();
  }

  return (
    <>
      <div
        data-testid="selection-tray"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-paper-raised pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            onClick={() => setListOpen(true)}
            aria-label={t('corpus.tray.openListLabel')}
            className="flex min-h-11 items-center justify-between gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span className="font-mono text-mono text-ink">
              {t('corpus.rail.selectedCount', { count: selectedCount })}
            </span>
            {visibleIds.length > 0 && (
              <span className="truncate font-mono text-mono text-ink-muted">
                {visibleIds.join(' ')}
                {overflowCount > 0 && ` +${overflowCount}`}
              </span>
            )}
          </button>
          <p id={reasonId} className="text-label text-ink-secondary">
            {modeText}
          </p>
          <Button
            type="button"
            disabled={!ctaEnabled}
            aria-describedby={ctaEnabled ? undefined : reasonId}
            onClick={handleCtaClick}
          >
            {ctaLabel}
          </Button>
        </div>
      </div>

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent title={t('corpus.eyebrow')} side="bottom">
          <CorpusListPanel
            className="min-h-0 flex-1"
            onOpenAbstract={handleOpenAbstract}
            onOpenEmbeddings={handleOpenEmbeddings}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
