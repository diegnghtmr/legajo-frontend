import type { ReactNode } from 'react';

export interface ParameterColumnProps {
  /** The mono step number, e.g. `01`. */
  step: string;
  title: string;
  titleId: string;
  /** Right-aligned next to the title (a count, a status tag). */
  aside?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}

/**
 * One numbered column of the clustering parameter panel: a header (mono step
 * number, a title that labels the column's control, an optional aside), the
 * control, and an optional muted hint. The column takes the intrinsic width
 * of its control; the hint wraps to that width and never widens it.
 */
export function ParameterColumn({
  step,
  title,
  titleId,
  aside,
  children,
  hint,
}: ParameterColumnProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-eyebrow text-ink-muted">{step}</span>
          <h3 id={titleId} className="text-body font-semibold text-ink">
            {title}
          </h3>
        </div>
        {aside}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
      {hint !== undefined && <p className="w-0 min-w-full text-label text-ink-muted">{hint}</p>}
    </div>
  );
}
