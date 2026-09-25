import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { sortedPair, useSelectionStore } from './selectionStore';

export interface AdaptiveSelectionCta {
  /** How many articles are currently selected — the desktop rail's footer
   * and the mobile tray's summary both show this same number. */
  selectedCount: number;
  ctaLabel: string;
  ctaEnabled: boolean;
  modeText: string;
  onCtaClick: () => void;
}

/**
 * The single adaptive selection CTA's own rule (PRD HU-1.1, TRD FTR-UI),
 * extracted out of `SelectionRail` so `SelectionTray` — the same rule
 * below `lg` — never re-derives it independently and risks disagreeing on
 * when the CTA is enabled or where it navigates. Below two selected it is
 * disabled with a reason; at exactly two it opens the pairwise comparison;
 * at three or more it opens the similarity matrix. The CTA never leads to a
 * dead end: no error page, no blank result.
 */
export function useAdaptiveSelectionCta(): AdaptiveSelectionCta {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const selectedCount = selectedIds.length;

  // `sortedPair` returns a pair only for exactly two selected ids — the same
  // condition the "pairwise" branch below needs, so branching on the pair
  // itself (rather than re-checking `selectedCount === 2`) keeps the two
  // conditions from ever drifting apart.
  const pair = sortedPair(selectedIds);

  if (selectedCount < 2) {
    return {
      selectedCount,
      ctaLabel: t('corpus.rail.cta.compare'),
      ctaEnabled: false,
      modeText: t('corpus.rail.mode.reason'),
      onCtaClick: () => {},
    };
  }

  if (pair) {
    // Sorted, never the raw toggle order — selecting d02 before d01 must
    // still read "Comparar d01 y d02", the same order the compare screen
    // itself derives (`sortedPair`), so the label never promises an order
    // the results then contradict.
    const [a, b] = pair;
    return {
      selectedCount,
      ctaLabel: t('corpus.rail.cta.comparePair', { a, b }),
      ctaEnabled: true,
      modeText: t('corpus.rail.mode.pairwise'),
      onCtaClick: () => void navigate('/similarity'),
    };
  }

  return {
    selectedCount,
    ctaLabel: t('corpus.rail.cta.viewMatrix', { count: selectedCount }),
    ctaEnabled: true,
    modeText: t('corpus.rail.mode.matrix'),
    onCtaClick: () => void navigate('/similarity/matrix'),
  };
}
