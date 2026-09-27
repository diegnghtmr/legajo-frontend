import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { cardSurfaceClassName } from './ui/card';

export interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Forwarded verbatim, e.g. for an e2e test to select this exact panel
   * across both its skeleton and loaded states. */
  'data-testid'?: string;
}

/**
 * The card token's surface, composed from the shadcn `Card` primitive's own
 * className rather than a hand-rolled duplicate. Renders a `<section>`
 * instead of `Card`'s `<div>` so trace and metric panels stay an
 * identifiable landmark; `Card` has no padding of its own (its compound
 * `CardHeader`/`CardContent` children carry it), so Panel keeps its own flat
 * `p-4` for its simpler single-region usage.
 */
export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <section className={cn(cardSurfaceClassName, 'p-4', className)} {...props}>
      {children}
    </section>
  );
}

export interface PanelHeaderProps {
  eyebrow?: string;
  /** A plain string for most headers; `ReactNode` is accepted so a caller
   * needing part of the title in a different treatment (e.g. the
   * similarity compare screen's own mono document ids) can compose it,
   * the same way `SegmentedOption.label` already does. */
  title: ReactNode;
  subtitle?: string;
}

/** Eyebrow + title + subtitle stack, e.g. `Traza` / DP algorithm name / subtitle. */
export function PanelHeader({ eyebrow, title, subtitle }: PanelHeaderProps) {
  return (
    <header className="mb-3 flex flex-col gap-1">
      {eyebrow && (
        <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {eyebrow}
        </p>
      )}
      <h2 className="text-title font-semibold text-ink">{title}</h2>
      {subtitle && <p className="text-body text-ink-muted">{subtitle}</p>}
    </header>
  );
}
