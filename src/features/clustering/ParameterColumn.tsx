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
 * control, and an optional muted hint. The column fills its grid track; a
 * hairline rule separates it from the previous column (on top when stacked,
 * on the left in the row layout). The hint wraps to the track width.
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
    <div className="flex min-w-0 flex-col gap-3 border-hairline px-5 pt-4 pb-[18px] not-first:border-t min-[1100px]:not-first:border-t-0 min-[1100px]:not-first:border-l">
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
