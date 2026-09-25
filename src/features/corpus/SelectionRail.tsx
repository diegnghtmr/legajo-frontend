import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../shared/components/ui/button';
import {
  CorpusListPanel,
  CORPUS_LIST_QUERY_KEY,
  EMBEDDINGS_STATUS_QUERY_KEY,
} from './CorpusListPanel';
import { useAdaptiveSelectionCta } from './useAdaptiveSelectionCta';

export { CORPUS_LIST_QUERY_KEY, EMBEDDINGS_STATUS_QUERY_KEY };
export { embeddingsSummaryState } from './CorpusListPanel';

export interface SelectionRailProps {
  onOpenAbstract: (id: string) => void;
  onOpenEmbeddings: () => void;
  /** Called the instant the CTA is activated, in addition to (never instead
   * of) its own navigation — mirrors `SelectionTray`'s own
   * `onCtaActivate` so `SimilarityWorkbenchLayout` records a comparison as
   * confirmed from either rail, never only the below-`lg` one. */
  onCtaActivate?: () => void;
}

/**
 * The persistent, `lg`+ corpus selection rail: `CorpusListPanel` (search,
 * compact rows, the embeddings status summary) plus the pinned footer with
 * the one adaptive CTA — `useAdaptiveSelectionCta`, shared with the below-
 * `lg` `SelectionTray` — that always lands on a real screen: pairwise
 * compare at exactly two selected, the matrix at three or more, disabled
 * with a reason below two.
 */
export function SelectionRail({
  onOpenAbstract,
  onOpenEmbeddings,
  onCtaActivate,
}: SelectionRailProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const { selectedCount, ctaLabel, ctaEnabled, modeText, onCtaClick } = useAdaptiveSelectionCta();

  function handleCtaClick() {
    onCtaActivate?.();
    onCtaClick();
  }

  return (
    <aside aria-label={t('corpus.eyebrow')} className="flex h-full flex-col">
      <CorpusListPanel
        className="min-h-0 flex-1"
        onOpenAbstract={onOpenAbstract}
        onOpenEmbeddings={onOpenEmbeddings}
      />

      <div className="flex flex-col gap-2 border-t border-hairline p-4">
        <div>
          <p className="font-mono text-mono text-ink">
            {t('corpus.rail.selectedCount', { count: selectedCount })}
          </p>
          <p id={reasonId} className="text-label text-ink-secondary">
            {modeText}
          </p>
        </div>
        <Button
          type="button"
          disabled={!ctaEnabled}
          aria-describedby={ctaEnabled ? undefined : reasonId}
          onClick={handleCtaClick}
        >
          {ctaLabel}
        </Button>
      </div>
    </aside>
  );
}
