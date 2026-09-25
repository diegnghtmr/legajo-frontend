import { MAIN_CONTENT_ID } from '../../shared/lib/shellMetrics';

/** The attribute both `CompareTable`'s row button and
 * `CompareResultsList`'s row button carry, set to that row's own algorithm
 * id — the lookup key {@link restoreTraceTrigger} uses once the remembered
 * element itself is gone, to find whichever of the two views (table at
 * `lg`+, list below it) is *currently* mounted for that same algorithm. */
const TRACE_TRIGGER_ATTRIBUTE = 'data-algorithm-trigger';

/**
 * Remembers which compare row opened the trace currently shown in the
 * detail panel, so closing it (however it closes — the panel's own close
 * button, `Esc`, or the below-`lg` sheet's dismissal) can return focus
 * there, the same as closing any other detail view returns focus to
 * whatever control opened it. A trace opens through a plain client-side navigation
 * (`/similarity/:algorithmId/trace`), not a callback the workbench layout
 * itself receives, so there is no natural place to pass this element
 * through props from the row (in `CompareTable`, several component layers
 * below the layout) to the layout that eventually closes it — a single,
 * same-tab, synchronous slot is the simplest correct link between the two.
 *
 * The slot is cleared — by every path that ends the trace, not only the
 * one that actually focuses it — so a later close (one that never followed
 * a row click, such as a bookmarked deep link) never refocuses a stale,
 * unrelated row: `restoreTraceTrigger` clears it after using it, and
 * `clearTraceTrigger` clears it without focusing anything for every other
 * path that ends a trace without the person's own close action on it (the
 * rail naming a different pair, the rail's own abstract/embeddings view
 * replacing it, or the workbench unmounting outright). `restoreTraceTrigger`
 * also never blindly focuses a remembered element that is no longer
 * attached to the document — the breakpoint crossing `lg` while the trace
 * stayed open (`CompareTable` unmounts in favor of `CompareResultsList`, or
 * back), one of those other paths having left it stale despite the
 * clearing above, or the row itself having since unmounted. The remembered
 * algorithm id lets it look up that exact row's trigger in whichever of
 * the two views is mounted *now* instead, falling back to the app shell's
 * own `<main>` landmark only once neither the original element nor a
 * same-algorithm row can be found at all.
 */
let lastTraceTrigger: HTMLElement | null = null;
let lastTraceAlgorithmId: string | null = null;

export function rememberTraceTrigger(element: HTMLElement | null, algorithmId: string): void {
  lastTraceTrigger = element;
  lastTraceAlgorithmId = algorithmId;
}

/** Ends this module's tracking of the currently-open trace's own trigger
 * without moving focus. Call this from every path that ends a trace other
 * than the trace's own close action (which uses {@link restoreTraceTrigger}
 * instead) — each of those already moves focus somewhere else on its own,
 * or unmounts the row entirely, so this only prevents a *later*, unrelated
 * trace close from focusing this no-longer-current button. */
export function clearTraceTrigger(): void {
  lastTraceTrigger = null;
  lastTraceAlgorithmId = null;
}

/** Finds the *currently mounted* trigger for `algorithmId` — the table's
 * row button at `lg`+, the list's below it, whichever is actually in the
 * document right now — never a `querySelector('button')` guess at DOM
 * order, which every row's own trigger would equally match. */
function findTriggerByAlgorithmId(algorithmId: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[${TRACE_TRIGGER_ATTRIBUTE}]`);
  for (const candidate of candidates) {
    if (candidate.getAttribute(TRACE_TRIGGER_ATTRIBUTE) === algorithmId) {
      return candidate;
    }
  }
  return null;
}

export function restoreTraceTrigger(): void {
  const remembered = lastTraceTrigger?.isConnected === true ? lastTraceTrigger : null;
  const target =
    remembered ??
    (lastTraceAlgorithmId !== null ? findTriggerByAlgorithmId(lastTraceAlgorithmId) : null) ??
    document.getElementById(MAIN_CONTENT_ID);
  lastTraceTrigger = null;
  lastTraceAlgorithmId = null;
  target?.focus();
}
