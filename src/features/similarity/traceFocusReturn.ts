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
 * same-tab, synchronous slot is the simplest correct link between the two,
 * and is cleared as soon as it is used so a later close (e.g. one that
 * never followed a row click, such as a bookmarked deep link) never
 * refocuses a stale element.
 */
let lastTraceTrigger: HTMLElement | null = null;

export function rememberTraceTrigger(element: HTMLElement | null): void {
  lastTraceTrigger = element;
}

export function restoreTraceTrigger(): void {
  lastTraceTrigger?.focus();
  lastTraceTrigger = null;
}
