import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface PanelProps {
  children: ReactNode;
  className?: string;
}

/** Card surface (the `components.card` token): hairline border, one quiet shadow, no glassmorphism. */
export function Panel({ children, className }: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-md border border-hairline bg-paper-raised p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export interface PanelHeaderProps {
  eyebrow?: string;
  title: string;
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
