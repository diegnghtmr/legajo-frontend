import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { Panel, PanelHeader } from '../../shared/components/Panel';
import { buttonVariants } from '../../shared/components/ui/button';
import { useIsAtLeastLg } from '../../shared/lib/useIsAtLeastLg';
import { sortedPair, useSelectionStore } from '../corpus/selectionStore';
import { SimilarityCompareView } from './SimilarityCompareView';
import { SimilarityMatrixView } from './SimilarityMatrixPage';
import { clearTraceTrigger } from './traceFocusReturn';

export { ALGORITHMS_QUERY_KEY } from './SimilarityCompareView';

/**
 * Similarity compare screen. Reads the compared pair either from the trace
 * deep link's own `documentIdA`/`documentIdB` search params (when this route
 * matched `/similarity/:algorithmId/trace`) or, otherwise, from the shared
 * corpus `selectionStore` — exactly two selected, never auto-picked. Both
 * `/similarity` and `/similarity/:algorithmId/trace` render this same
 * component: a trace deep link never swaps the pairwise results out for a
 * trace-only screen, it only makes `SimilarityWorkbenchLayout` additionally
 * open that algorithm's trace in the detail panel next to these same
 * results.
 *
 * `pair` is either `null` (no exactly-two selection to compare) or a real
 * `[a, b]` tuple, and only the latter is ever passed down to
 * `SimilarityCompareView`, which is the only place a compare query gets
 * created — there is no blank-id fallback to guard.
 *
 * At `lg` and above the center follows the corpus selection automatically,
 * the same rule for both counts: exactly two shows the pair, three or more
 * shows the matrix in this same center region, with no click either way —
 * `SimilarityMatrixView`, the same view `/similarity/matrix` itself renders,
 * so the two are never a separate screen a person has to navigate to. Below
 * `lg` this is unchanged: `SimilarityWorkbenchLayout` keeps the corpus list
 * as the main content until the tray's own CTA confirms a comparison, for
 * both counts, so this empty-state-with-matrix-link branch stays reachable
 * there.
 *
 * The rail always wins once it names a real, different pair from the one a
 * trace deep link supplied: the link only drives the compared pair while
 * nothing else names one, or while the rail still agrees with it, never
 * after the person has since picked a different pair in the rail. That
 * switch also leaves the trace route entirely (back to plain `/similarity`,
 * with this same rail pair carried into the URL) instead of leaving a now
 *-mismatched trace open next to a different comparison.
 */
export function SimilarityPage() {
  const { t } = useTranslation();
  const { algorithmId: traceAlgorithmId } = useParams<{ algorithmId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAtLeastLg = useIsAtLeastLg();
  const selectedArticleIds = useSelectionStore((state) => state.selectedIds);
  const canMatrix = useSelectionStore((state) => state.canMatrix);

  const isTraceRoute = traceAlgorithmId !== undefined;
  const urlDocumentIdA = searchParams.get('documentIdA');
  const urlDocumentIdB = searchParams.get('documentIdB');
  // Normalized the same way the rail's own pair is (`sortedPair`), so a
  // reversed deep link (`documentIdA`/`documentIdB` swapped) still compares
  // — and labels — the pair in the same order regardless of which query
  // param named which id. The same document named twice is degenerate, not
  // a pair, so it is never even handed to `sortedPair` (which does not
  // itself reject that shape — both its inputs are already known-distinct
  // ids everywhere else it's called).
  const urlPair: readonly [string, string] | null =
    isTraceRoute && urlDocumentIdA && urlDocumentIdB && urlDocumentIdA !== urlDocumentIdB
      ? sortedPair([urlDocumentIdA, urlDocumentIdB])
      : null;
  const railPair = sortedPair(selectedArticleIds);
  // Whether the rail has ever named a real selection during this mount —
  // monotonic (once true, never resets to false), adjusted during render
  // the same way `SimilarityWorkbenchLayout`'s own `confirmedPairKey`
  // is: a plain `useState` (never a ref; refs cannot be read during render
  // under this same lint config) that survives a later Limpiar or
  // deselection reducing `selectedArticleIds` back to zero. Distinguishes
  // "the rail has never spoken yet" (still `[]`, a cold deep link whose own
  // seed effect in the layout has not resolved) — where the URL pair is
  // still the right thing to preview — from "the rail just spoke, and its
  // answer is `[]` or an insufficient count" (a deselection, or Limpiar) —
  // where the rail's own (non-)answer must win outright, never falling
  // back to a now-stale URL pair.
  const [railHasBeenTouched, setRailHasBeenTouched] = useState(selectedArticleIds.length > 0);
  if (selectedArticleIds.length > 0 && !railHasBeenTouched) {
    setRailHasBeenTouched(true);
  }
  const pair = railHasBeenTouched ? railPair : urlPair;

  // The deep link's own pair is stale once the rail has spoken for itself
  // and no longer agrees with it — whether by naming a different, real
  // pair, or by no longer forming a pair at all (a deselection, or
  // Limpiar) — leave the trace route and drop its now-mismatched document
  // ids, carrying whatever the rail says now (a real pair, or nothing)
  // into the plain `/similarity` URL instead of leaving the stale
  // comparison and its trace panel on screen.
  const staleTracePair =
    isTraceRoute &&
    urlPair !== null &&
    railHasBeenTouched &&
    (railPair === null || railPair[0] !== urlPair[0] || railPair[1] !== urlPair[1]);

  useEffect(() => {
    if (!staleTracePair) {
      return;
    }
    // The rail — not the person's own close action on the trace — is what
    // ends it here, so this clears the row's remembered focus-return target
    // without focusing anything: a later, unrelated trace's own close must
    // never land on this now-stale row (`traceFocusReturn`'s own contract).
    clearTraceTrigger();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('documentIdA');
    nextParams.delete('documentIdB');
    const search = nextParams.toString();
    navigate(`/similarity${search ? `?${search}` : ''}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running this for every render `staleTracePair` stays true is harmless (the navigate below leaves the trace route on its very next commit, which flips the condition false); listing `searchParams`/`navigate` here would only make it re-run for reasons that never change what it does.
  }, [staleTracePair]);

  if (pair === null) {
    // Three or more selected, with no exact pair to render: at `lg` and
    // above the matrix already shows automatically in this same center
    // region — the same "no click either way" rule the exactly-two case
    // already gets from `pair` resolving above. Below `lg` this branch
    // stays exactly as it always has (the tray's own CTA is what confirms
    // the matrix there, via `/similarity/matrix`).
    if (isAtLeastLg && canMatrix) {
      return <SimilarityMatrixView />;
    }

    return (
      <div className="flex flex-col gap-4">
        <PanelHeader eyebrow={t('similarity.eyebrow')} title={t('similarity.title')} />
        <Panel>
          <p role="status" className="text-body text-ink-secondary">
            {t('similarity.selection.emptyState')}
          </p>
          {canMatrix && (
            <div className="mt-3">
              <Link to="/similarity/matrix" className={buttonVariants({ variant: 'secondary' })}>
                {t('similarity.selection.viewMatrix')}
              </Link>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  return <SimilarityCompareView pair={pair} openAlgorithmId={traceAlgorithmId ?? null} />;
}
