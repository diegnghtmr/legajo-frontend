import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface WorkbenchLayoutProps {
  /** The corpus selection rail. Omitted on screens with no rail (clustering,
   * benchmarks). */
  rail?: ReactNode;
  /** The trace or abstract detail panel. Only rendered once open. */
  detail?: ReactNode;
  /** The screen's own results content. */
  children: ReactNode;
}

/**
 * The workbench's three named regions: a 320px rail on the left, the
 * results in the center, and a 460px detail panel on the right.
 * `AppLayout`'s own `<main>` already carries the page's `p-6` padding and
 * `gap-6`, which would show as a visible margin around the rail's hairline
 * border — this component cancels that with a negative margin the same size
 * (`-m-6`) and re-applies padding only to its own `main` cell, so the rail
 * and the detail panel stay flush against the viewport edge while the
 * center keeps the usual page padding.
 *
 * Breakpoints follow the same scale `AppLayout`'s nav collapse uses
 * (Tailwind `lg` = 1024px, `xl` = 1280px): at `xl` the detail panel is
 * docked in its own column; between `lg` and `xl` it overlays the right
 * edge of the center instead (the center floor is 480px, and 320 + 480 +
 * 460 already exceeds 1279px, which is why it cannot dock there without
 * shrinking the center below its floor). Below `lg` neither the rail nor
 * the detail column renders here — a narrow/mobile tray and sheet replace
 * them.
 */
export function WorkbenchLayout({ rail, detail, children }: WorkbenchLayoutProps) {
  return (
    <div className={cn('-m-6 flex flex-1 flex-col lg:flex-row', detail && 'lg:relative')}>
      {rail && (
        <div className="hidden shrink-0 border-r border-hairline bg-paper-raised lg:block lg:w-[320px]">
          {rail}
        </div>
      )}
      <div className="min-w-0 flex-1 p-6">{children}</div>
      {detail && (
        <div
          className={cn(
            'border-l border-hairline bg-paper-raised',
            'lg:absolute lg:inset-y-0 lg:right-0 lg:w-[460px] lg:overflow-y-auto',
            'xl:static xl:w-[460px] xl:shrink-0',
          )}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
