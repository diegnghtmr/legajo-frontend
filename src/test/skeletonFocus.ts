const FOCUSABLE_SELECTOR =
  '[tabindex]:not([tabindex="-1"]), a[href], button, input, select, textarea';

const NATIVE_CONTROL_SELECTOR = 'a, button, input, select, textarea';
/** `aria-hidden` set by an open dialog on the page behind it (`data-aria-hidden`) is
 * not a placeholder subtree. */
const PLACEHOLDER_HIDDEN_SELECTOR = '[aria-hidden="true"]:not([data-aria-hidden])';

/**
 * The focusable elements a skeleton must not hold: a tab stop that wraps
 * placeholder blocks (a scroll viewport around `aria-hidden` blocks), or any
 * focusable element inside an `aria-hidden` subtree. A real control that only
 * carries an inline placeholder value (a button whose label ends in a
 * loading bar) is a control around a skeleton, not a skeleton's own stop.
 */
export function focusableInSkeletons(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      (element.querySelector('[data-slot="skeleton"]') !== null &&
        !element.matches(NATIVE_CONTROL_SELECTOR)) ||
      element.closest(PLACEHOLDER_HIDDEN_SELECTOR) !== null,
  );
}
