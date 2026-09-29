import { expect, type Page } from '@playwright/test';

/** The handful of DOM members this file's own browser-side callback needs,
 * spelled out locally rather than adding the `dom` lib (which this
 * project's Node-typed e2e tsconfig deliberately omits) — the same
 * technique `loadingText.ts` uses. */
interface FocusElement {
  tagName: string;
  matches(selector: string): boolean;
  closest(selector: string): FocusElement | null;
  querySelector(selector: string): FocusElement | null;
  getAttribute(name: string): string | null;
}
interface FocusDocument {
  querySelectorAll(selector: string): ArrayLike<FocusElement>;
}

/** A tab stop: `tabindex="-1"` takes a native control out of the tab order, so
 * a pointer-only shortcut (the score strip's dots) inside a decorative
 * subtree is not one. */
const FOCUSABLE_SELECTOR = [
  '[tabindex]:not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'button:not([tabindex="-1"])',
  'input:not([tabindex="-1"])',
  'select:not([tabindex="-1"])',
  'textarea:not([tabindex="-1"])',
].join(', ');
const NATIVE_CONTROL_SELECTOR = 'a, button, input, select, textarea';
/** `aria-hidden` set by an open dialog on the page behind it (`data-aria-hidden`) is
 * not a placeholder subtree. */
const PLACEHOLDER_HIDDEN_SELECTOR = '[aria-hidden="true"]:not([data-aria-hidden])';

/**
 * A skeleton holds no focusable element: no tab stop wraps placeholder
 * blocks (a scroll viewport around `aria-hidden` bars) and nothing focusable
 * sits inside an `aria-hidden` subtree. A real control that only carries an
 * inline placeholder value is a control around a skeleton, not its own stop.
 */
export async function expectSkeletonsHoldNoFocusable(page: Page): Promise<void> {
  const offenders = await page.evaluate(
    ([focusable, nativeControl, hidden]) => {
      const doc = (globalThis as unknown as { document: FocusDocument }).document;
      const found: string[] = [];
      const elements = doc.querySelectorAll(focusable!);
      for (let i = 0; i < elements.length; i += 1) {
        const element = elements[i]!;
        const wrapsPlaceholder =
          element.querySelector('[data-slot="skeleton"]') !== null &&
          !element.matches(nativeControl!);
        if (wrapsPlaceholder || element.closest(hidden!) !== null) {
          found.push(`${element.tagName.toLowerCase()}[role=${element.getAttribute('role')}]`);
        }
      }
      return found;
    },
    [FOCUSABLE_SELECTOR, NATIVE_CONTROL_SELECTOR, PLACEHOLDER_HIDDEN_SELECTOR],
  );

  expect(offenders, `focusable elements inside a skeleton: ${offenders.join(', ')}`).toEqual([]);
}
