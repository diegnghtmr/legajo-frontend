import type { CSSProperties } from 'react';

/**
 * The app shell's own header height and main-content padding, defined once
 * so every component whose layout depends on either value reads it from
 * here instead of repeating the number. `AppLayout` sets these two custom
 * properties on its root element via {@link shellMetricsStyle}; any
 * descendant — such as `WorkbenchLayout`'s own height/margin math — reads
 * them back through `var(--shell-header-h)` / `var(--shell-main-pad)`
 * instead of hard-coding the same rem value a second time. Changing either
 * constant below changes both the shell's own layout and every consumer in
 * the same place.
 */
export const SHELL_HEADER_HEIGHT_VAR = '--shell-header-h';
export const SHELL_MAIN_PADDING_VAR = '--shell-main-pad';

/** `AppLayout`'s own `<main>` landmark id — focusable (`tabIndex={-1}`) and
 * unique in the tree, so it also serves as the last-resort focus target for
 * anything that would otherwise return focus to an element that no longer
 * exists (e.g. `traceFocusReturn`'s own fallback). */
export const MAIN_CONTENT_ID = 'main-content';

/** Matches `AppLayout`'s header, `h-14`. */
export const SHELL_HEADER_HEIGHT = '3.5rem';
/** Matches `AppLayout`'s `<main>`, `p-6`. */
export const SHELL_MAIN_PADDING = '1.5rem';

/** Applied to the app shell's own root element. Tailwind 4's parentheses
 * shorthand (`h-(--shell-header-h)`, `p-(--shell-main-pad)`) and arbitrary
 * `calc()` values referencing these same custom properties are how
 * `AppLayout` and `WorkbenchLayout` both consume this without importing a
 * runtime value into a build-time class name. */
export const shellMetricsStyle = {
  [SHELL_HEADER_HEIGHT_VAR]: SHELL_HEADER_HEIGHT,
  [SHELL_MAIN_PADDING_VAR]: SHELL_MAIN_PADDING,
} as CSSProperties;
