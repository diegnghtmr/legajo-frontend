import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';

import { useIsAtLeastLg } from '../../shared/lib/useIsAtLeastLg';
import { WorkbenchLayout } from '../../shared/components/WorkbenchLayout';
import { Button } from '../../shared/components/ui/button';
import { Sheet, SheetContent } from '../../shared/components/ui/sheet';
import { ArticleAbstract } from '../corpus/ArticleAbstract';
import { CorpusListPanel } from '../corpus/CorpusListPanel';
import { EmbeddingsStatusPanel } from '../corpus/EmbeddingsStatusPanel';
import { SelectionRail } from '../corpus/SelectionRail';
import { SelectionTray } from '../corpus/SelectionTray';
import { sortedPair, useSelectionStore } from '../corpus/selectionStore';
import { clearTraceTrigger, restoreTraceTrigger } from './traceFocusReturn';
import { TraceDetailPanel } from './traces/TraceDetailPanel';

/** The plain pairwise-compare path — never its matrix or trace-deep-link
 * siblings, which always already name a pair (by selection count or by the
 * URL itself). Only this exact path ever swaps its routed content for the
 * corpus list below `lg` (see `showCorpusListAsMainContent` below). */
const PLAIN_COMPARE_PATH = '/similarity';

type DetailView = { kind: 'abstract'; id: string } | { kind: 'embeddings' } | null;

/** The trace deep link's own path shape, matched against the live location
 * rather than read through `useParams` (which only ever sees the params of
 * the route actually rendering the component that calls it — this layout
 * sits one level above whichever route matched, `similarity` or its trace
 * deep link, so it reads the location directly instead). */
const TRACE_ROUTE_PATTERN = '/similarity/:algorithmId/trace';

/**
 * Layout route for the similarity screens (compare, matrix, trace): the
 * persistent selection rail on the left, the routed screen's own results in
 * the center, and — once a rail row's title, the embeddings status line, or
 * a compare row's own trace trigger is activated — the abstract, the
 * embeddings detail, or the trace in the detail region on the right. Only
 * one detail view is open at a time; opening one replaces the other.
 *
 * The trace deep link (`/similarity/:algorithmId/trace`) is read straight
 * from the URL rather than tracked as local state, exactly like the
 * `SimilarityPage` it renders alongside: this is what lets a bookmarked
 * trace link, browser back/forward, and a row click all open the same
 * panel through the same one code path, and what lets closing it be a
 * plain navigation back to `/similarity` instead of a second, parallel
 * "closed" representation that could drift from the URL.
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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  // `sortedPair` is the exact same pair-or-null rule `SimilarityPage` itself
  // uses for the plain path (no trace deep link ever overrides it there),
  // so the two can never disagree about when a pair exists.
  const pair = sortedPair(selectedIds);
  const pairKey = pair ? `${pair[0]}:${pair[1]}` : null;
  // A pair EXISTING is not the same as a comparison being CONFIRMED: at
  // exactly two selected, the CTA's own navigation targets this same plain
  // path (there is nowhere else for it to go), so pair-existence alone
  // cannot distinguish "just selected the second article" from "activated
  // the CTA" the way the three-or-more case can (its own CTA navigates to
  // a genuinely different `/similarity/matrix` route). Below `lg` this
  // tracks the exact pair the tray's own CTA was last activated for —
  // `SelectionTray`'s `onCtaActivate` sets it — so selecting a second
  // article alone never swaps the corpus list out from under the person
  // mid-tap: a basic comparison stays select, select, compare — three
  // interactions, not two. Seeded from whatever pair already exists the
  // instant this layout first mounts (a deep link, a restored selection,
  // or simply already having a pair from an earlier visit): only a pair
  // assembled interactively AFTER arriving here needs its own explicit
  // confirmation — nothing requires that returning to an already-selected
  // pair must redundantly repeat that confirmation, so this mount-time
  // seeding is a conservative, reviewable choice. A
  // DIFFERENT pair assembled afterwards (or none at all) always needs its
  // own fresh confirmation, since it no longer matches this remembered key.
  const [confirmedPairKey, setConfirmedPairKey] = useState<string | null>(() => pairKey);
  const isPairConfirmed = pairKey !== null && pairKey === confirmedPairKey;
  // Below `lg`, before any comparison is confirmed on the plain compare path
  // (never its matrix or trace-deep-link siblings — see
  // `PLAIN_COMPARE_PATH`), the similarity screen's own main content is the
  // corpus list itself rather than `SimilarityPage`'s "select 2 to compare"
  // message.
  const showCorpusListAsMainContent =
    !isAtLeastLg && location.pathname === PLAIN_COMPARE_PATH && !isPairConfirmed;
  // The exact control that opened the currently-shown detail view (a rail
  // row's title, or the embeddings status row) — closing it returns focus
  // there instead of dropping it back to the document body, the same way
  // the app shell's own collapsible nav returns focus to its toggle button.
  // A trace's own trigger (a compare row) is tracked separately, by the row
  // itself (`traceFocusReturn`), since opening a trace never goes through
  // `openAbstract`/`openEmbeddings` below.
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
  // Which of the two restore targets the deferred effect above should use
  // for the *next* close: the trace's own remembered trigger
  // (`traceFocusReturn`) or this layout's own `triggerRef` for a local
  // (abstract/embeddings) detail view. Set from `isTraceOpen` while a
  // detail view is open, since by the time the effect actually runs the
  // close has already committed and `isTraceOpen` itself has flipped back
  // to `false` — reading it directly at that point would always pick the
  // local branch.
  const wasTraceRef = useRef(false);

  const traceMatch = matchPath(TRACE_ROUTE_PATTERN, location.pathname);
  const traceAlgorithmId = traceMatch?.params.algorithmId;
  const traceDocumentIdA = searchParams.get('documentIdA');
  const traceDocumentIdB = searchParams.get('documentIdB');
  const isTraceOpen = Boolean(traceAlgorithmId && traceDocumentIdA && traceDocumentIdB);
  // The trace route matched, but at least one of its own document ids is
  // missing — a hand-edited or truncated URL, never one this layout's own
  // navigations produce. Nothing renders for it (`isTraceOpen` is false), so
  // the URL is normalized back to plain `/similarity` instead of leaving a
  // trace path visible over a screen that shows no trace at all.
  const hasPartialTraceRoute = traceAlgorithmId !== undefined && !isTraceOpen;

  function navigateAwayFromTrace() {
    if (!isTraceOpen) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('documentIdA');
    nextParams.delete('documentIdB');
    const search = nextParams.toString();
    navigate(`/similarity${search ? `?${search}` : ''}`);
  }

  useEffect(() => {
    if (!hasPartialTraceRoute) {
      return;
    }
    clearTraceTrigger();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('documentIdA');
    nextParams.delete('documentIdB');
    const search = nextParams.toString();
    navigate(`/similarity${search ? `?${search}` : ''}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running this for every render `hasPartialTraceRoute` stays true is harmless (the navigate below leaves the trace route on its very next commit, which flips the condition false); listing `searchParams`/`navigate` here would only make it re-run for reasons that never change what it does.
  }, [hasPartialTraceRoute]);

  // A trace unmounts whatever local detail view (abstract/embeddings) was
  // open before it, "one panel at a time" — `localDetail` below already
  // keeps it from rendering meanwhile, but `detail` state itself must be
  // cleared too, or it would resurrect unrequested once the trace closes
  // and `localDetail` reverts to reading it again. Adjusted here, during
  // render, the instant `isTraceOpen` itself flips true — React's own
  // pattern for resetting one piece of state in response to another
  // changing (no ref reads here; those are never safe during render) —
  // rather than in an effect, which would let the stale `detail` value
  // commit to the DOM for one extra render, exactly what would otherwise
  // (briefly, but observably) resurrect it.
  const [wasTraceOpen, setWasTraceOpen] = useState(false);
  if (isTraceOpen !== wasTraceOpen) {
    setWasTraceOpen(isTraceOpen);
    if (isTraceOpen) {
      setDetail(null);
    }
  }

  // This also forgets the local detail view's own focus-return target
  // (`triggerRef`) so the effect further below never refocuses it once the
  // trace closes — the trace has its own trigger, tracked separately by
  // `traceFocusReturn` and restored by `closeDetail`. A plain ref mutation,
  // so (unlike the state adjustment above) this belongs in an effect, not
  // during render.
  useEffect(() => {
    if (isTraceOpen) {
      triggerRef.current = null;
    }
  }, [isTraceOpen]);

  function openAbstract(id: string) {
    navigateAwayFromTrace();
    // The rail — not the trace's own close action — is what ends an
    // already-open trace here, so its remembered focus-return target is
    // dropped without focusing anything: see `clearTraceTrigger`'s own
    // contract in `traceFocusReturn`.
    clearTraceTrigger();
    triggerRef.current = document.activeElement as HTMLElement | null;
    setDetail({ kind: 'abstract', id });
  }

  function openEmbeddings() {
    navigateAwayFromTrace();
    clearTraceTrigger();
    triggerRef.current = document.activeElement as HTMLElement | null;
    setDetail({ kind: 'embeddings' });
  }

  // Leaving the similarity screens entirely (a route change elsewhere in
  // the app, not any of this layout's own close paths above) still ends
  // whatever trace was open without ever calling `closeDetail` — this is
  // the layout's own last-resort clear for that path.
  useEffect(() => {
    return () => {
      clearTraceTrigger();
    };
  }, []);

  // Memoized: the docked/overlay panel's own `Esc` listener effect below
  // re-subscribes whenever this identity changes, so a stable reference
  // (recreated only when what it actually reads changes) keeps that from
  // happening on every unrelated render. The focus restore itself never
  // happens here — below `lg` this is the below-`lg` Sheet's own close
  // path, and Radix's focus trap is still mounted for the render where
  // `isTraceOpen` first flips false (it only unmounts *after* this
  // commits); calling `restoreTraceTrigger()` synchronously here would
  // fight that still-mounted trap and silently lose focus outright, the
  // exact hazard the `wasOpenRef` effect below already exists to avoid for
  // the local (abstract/embeddings) detail view. The trace-close case
  // shares that same effect instead, deferred to run after the commit.
  const closeDetail = useCallback(() => {
    if (isTraceOpen) {
      navigateAwayFromTrace();
      return;
    }
    setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `navigateAwayFromTrace` is a plain function recreated every render from the same `isTraceOpen`/`searchParams`/`navigate` this already depends on; listing it here would defeat the memoization this exists for.
  }, [isTraceOpen, searchParams, navigate]);

  // Opening a trace (a route change, not a `setDetail` call) replaces
  // whatever local detail view was open — "one panel at a time". Derived at
  // render time rather than cleared through a second effect that calls
  // `setDetail`: the local `detail` state itself stays exactly what the
  // person last chose, so re-opening the rail's own abstract/embeddings
  // view after closing a trace still remembers it, without a stale
  // now-hidden view ever actually rendering meanwhile.
  const localDetail = isTraceOpen ? null : detail;

  useEffect(() => {
    const anyDetailOpen = localDetail !== null || isTraceOpen;
    if (anyDetailOpen) {
      wasOpenRef.current = true;
      // Remembered for the close transition below: which restore target
      // applies depends on what was actually open, not on `isTraceOpen`'s
      // now-closed value read at that later point.
      wasTraceRef.current = isTraceOpen;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      if (wasTraceRef.current) {
        restoreTraceTrigger();
      } else {
        triggerRef.current?.focus();
        triggerRef.current = null;
      }
      wasTraceRef.current = false;
    }
  }, [localDetail, isTraceOpen]);

  // The docked/overlay panel (`lg` and above) is a non-modal `aside`, so it
  // never gets Radix's own `Esc`-closes-the-dialog behavior the way the
  // below-`lg` Sheet does — it needs its own listener. Below `lg`, closing
  // instead goes through `Sheet`'s own `onOpenChange`, so this only ever
  // fires while the docked/overlay region is what's actually showing it.
  useEffect(() => {
    if (!isTraceOpen || !isAtLeastLg) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDetail();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTraceOpen, isAtLeastLg, closeDetail]);

  const traceContent =
    isTraceOpen && traceAlgorithmId && traceDocumentIdA && traceDocumentIdB ? (
      <TraceDetailPanel
        algorithmId={traceAlgorithmId}
        documentIdA={traceDocumentIdA}
        documentIdB={traceDocumentIdB}
        onClose={closeDetail}
      />
    ) : null;

  const localDetailContent =
    localDetail?.kind === 'abstract' ? (
      <ArticleAbstract id={localDetail.id} onClose={closeDetail} />
    ) : localDetail?.kind === 'embeddings' ? (
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="flex justify-end">
          <Button variant="secondary" onClick={closeDetail}>
            {t('corpus.detail.closeLabel')}
          </Button>
        </div>
        <EmbeddingsStatusPanel />
      </div>
    ) : null;

  const detailContent = traceContent ?? localDetailContent;

  return (
    <>
      <WorkbenchLayout
        // Below `lg` there is no persistent sidebar rail at all — its
        // replacement is the docked `SelectionTray` plus, before any
        // comparison, the corpus list rendered as this same region's main
        // content (both below).
        rail={
          isAtLeastLg ? (
            <SelectionRail onOpenAbstract={openAbstract} onOpenEmbeddings={openEmbeddings} />
          ) : undefined
        }
        detail={isAtLeastLg ? (detailContent ?? undefined) : undefined}
      >
        {showCorpusListAsMainContent ? (
          // The docked tray below already carries the CTA and, on its own
          // sheet, this exact same list — this is the screen's own main
          // content only while no pair exists yet to compare, so the tray
          // never has to be opened just to make a first selection. `pb-28`
          // (below) keeps its own last row clear of the docked tray.
          <CorpusListPanel
            className="pb-28"
            onOpenAbstract={openAbstract}
            onOpenEmbeddings={openEmbeddings}
          />
        ) : (
          // Space for the docked tray below, so its own last row is never
          // hidden underneath it — only needed below `lg`, where the tray
          // exists at all.
          <div className={!isAtLeastLg ? 'pb-28' : undefined}>
            <Outlet />
          </div>
        )}
      </WorkbenchLayout>
      {!isAtLeastLg && (
        <>
          <SelectionTray
            onOpenAbstract={openAbstract}
            onOpenEmbeddings={openEmbeddings}
            onCtaActivate={() => setConfirmedPairKey(pairKey)}
          />
          <Sheet
            open={detailContent !== null}
            onOpenChange={(open) => {
              if (!open) {
                closeDetail();
              }
            }}
          >
            <SheetContent
              title={
                localDetail?.kind === 'abstract'
                  ? t('corpus.detail.sheetTitle', { id: localDetail.id })
                  : localDetail?.kind === 'embeddings'
                    ? t('corpus.embeddingsStatus.title')
                    : t('similarity.trace.eyebrow')
              }
            >
              {detailContent}
            </SheetContent>
          </Sheet>
        </>
      )}
    </>
  );
}
