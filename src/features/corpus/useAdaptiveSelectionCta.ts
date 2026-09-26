import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { SIMILARITY_RESULTS_REGION_ID } from '../similarity/similarityFocusTargets';
import { useIsAtLeastLg } from '../../shared/lib/useIsAtLeastLg';
import { sortedPair, useSelectionStore } from './selectionStore';

/** Moves focus onto the similarity workbench's own results region instead of
 * navigating — the keyboard/assistive-technology path once the center
 * already shows the pair or the matrix with no click (at `lg` and above,
 * `SimilarityWorkbenchLayout`'s `SIMILARITY_RESULTS_REGION_ID` landmark).
 * `document.getElementById` (rather than a ref) is the only option here:
 * this hook has no JSX of its own to attach one to, and the region it
 * targets is owned by a layout several components away, not by whichever
 * caller (`SelectionRail`, `SelectionTray`) happens to invoke this hook. */
function focusResultsRegion(): void {
  document.getElementById(SIMILARITY_RESULTS_REGION_ID)?.focus();
}

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
 * The single adaptive selection CTA's own rule, extracted out of
 * `SelectionRail` so `SelectionTray` — the same rule
 * below `lg` — never re-derives it independently and risks disagreeing on
 * when the CTA is enabled or where it navigates. Below two selected it is
 * disabled with a reason; at exactly two it opens the pairwise comparison;
 * at three or more it opens the similarity matrix. The CTA never leads to a
 * dead end: no error page, no blank result.
 *
 * At `lg` and above the center already shows that same result with no click
 * at all (`SimilarityWorkbenchLayout`, `SimilarityPage`,
 * `SimilarityMatrixPage`), so activating the CTA there is no longer a
 * required step — it moves focus onto the results region instead
 * (`focusResultsRegion`), the keyboard/assistive-technology equivalent of
 * "the results are already right there". Below `lg` nothing changes: the
 * corpus list stays the main content until this same CTA navigates and
 * confirms the comparison.
 */
export function useAdaptiveSelectionCta(): AdaptiveSelectionCta {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAtLeastLg = useIsAtLeastLg();
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
      onCtaClick: isAtLeastLg ? focusResultsRegion : () => void navigate('/similarity'),
    };
  }

  return {
    selectedCount,
    ctaLabel: t('corpus.rail.cta.viewMatrix', { count: selectedCount }),
    ctaEnabled: true,
    modeText: t('corpus.rail.mode.matrix'),
    onCtaClick: isAtLeastLg ? focusResultsRegion : () => void navigate('/similarity/matrix'),
  };
}
