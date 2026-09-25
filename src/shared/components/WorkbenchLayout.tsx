import type { CSSProperties, ReactNode } from 'react';

import { cn } from '../lib/cn';
import { SHELL_MAIN_PADDING_VAR } from '../lib/shellMetrics';

export interface WorkbenchLayoutProps {
  /** The corpus selection rail. Omitted on screens with no rail (clustering,
   * benchmarks). */
  rail?: ReactNode;
  /** The trace or abstract detail panel. Only rendered once open. */
  detail?: ReactNode;
  /** The screen's own results content. */
  children: ReactNode;
}

/** Cancels `AppLayout`'s own main padding by reading the same
 * `--shell-main-pad` custom property it sets, instead of repeating its rem
 * value as a second, independently-maintained number. */
const negativeMainPaddingStyle: CSSProperties = {
  margin: `calc(var(${SHELL_MAIN_PADDING_VAR}) * -1)`,
};

/**
 * The workbench's three named regions: a 320px rail on the left, the
 * results in the center, and a 460px detail panel on the right.
 * `AppLayout`'s own `<main>` already carries the page's own main padding
 * (`--shell-main-pad`, `AppLayout`'s `p-(--shell-main-pad)`) and `gap-6`,
 * which would show as a visible margin around the rail's hairline border —
 * this component cancels that with a negative margin of the same size,
 * read from that same custom property instead of repeating its rem value,
 * and re-applies padding only to its own `main` cell, so the rail and the
 * detail panel stay flush against the viewport edge while the center keeps
 * the usual page padding. Changing `AppLayout`'s own main padding (in
 * `shared/lib/shellMetrics`) changes this cancelling margin the same way,
 * with nothing to keep in sync by hand.
 *
 * Breakpoints follow the same scale `AppLayout`'s nav collapse uses
 * (Tailwind `lg` = 1024px, `xl` = 1280px): at `xl` the detail panel is
 * docked in its own column, sharing the viewport width with the rail and
 * the center; between `lg` and `xl` there isn't yet enough width for all
 * three side by side (320 + 460 alone already leaves under 480px of a
 * 1279px viewport for the center), so this is a deliberate overlay by
 * design instead — the panel floats over the right edge of the center
 * (`lg:absolute`, `xl:static` returns it to the normal flow once docked),
 * and the person viewing it dismisses it to see the center content
 * underneath. The center cell itself carries no enforced minimum width
 * (`min-w-0`) at any breakpoint.
 *
 * Below `lg` there is no persistent side rail and no side panel — the two
 * regions are asymmetric there, on purpose: the rail's own content still
 * stacks above the results in normal document flow (never `hidden`), since
 * it is a corpus's primary, always-relevant selection surface with no
 * narrow-width replacement yet (a dedicated bottom tray is a later
 * addition); the detail region, by contrast, is fully `hidden` below `lg`
 * — showing it as a third full-width stacked block here would bury the
 * results between two unrelated regions, so a consumer instead renders its
 * own detail content inline (within the results) or as a modal sheet for
 * narrow widths, never through this slot.
 *
 * From `lg`, this fills the exact remaining viewport height below the
 * top bar — `AppLayout`'s own `--shell-header-h` custom property, read
 * back here through `var()` rather than its rem value repeated — and clips
 * its own overflow, so each region scrolls independently with its own
 * header and footer pinned, instead of one long page scroll burying the
 * rail's footer under a tall corpus list. `flex-1` (flex-basis: 0%) would
 * win over that explicit height for this column flex child's main-axis
 * size, per the flex sizing algorithm, so it is deliberately absent here.
 */
export function WorkbenchLayout({ rail, detail, children }: WorkbenchLayoutProps) {
  return (
    <div
      data-testid="workbench-layout"
      style={negativeMainPaddingStyle}
      className={cn(
        'flex flex-col lg:h-[calc(100vh-var(--shell-header-h))] lg:flex-row lg:overflow-hidden',
        detail && 'lg:relative',
      )}
    >
      {rail && (
        <div
          data-testid="workbench-rail"
          className="shrink-0 border-b border-hairline bg-paper-raised lg:h-full lg:w-[320px] lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          {rail}
        </div>
      )}
      {/* The literal utility name below must stay a plain string — Tailwind's
          build-time scanner needs the exact class text in source, so it
          cannot be assembled from `SHELL_MAIN_PADDING_VAR` at runtime the
          way the `style` prop above reads that constant. */}
      <div className="min-w-0 flex-1 p-(--shell-main-pad)">{children}</div>
      {detail && (
        <div
          data-testid="workbench-detail"
          className={cn(
            'hidden border-hairline bg-paper-raised',
            'lg:block lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-[460px] lg:overflow-y-auto lg:border-l',
            'xl:static xl:w-[460px] xl:shrink-0',
          )}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
