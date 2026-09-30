import type { ReactNode } from 'react';

import { cn } from '../../shared/lib/cn';

export interface ParameterHeaderProps {
  /** The mono step number, e.g. `01`. */
  step: string;
  title: string;
  titleId: string;
  /** Right-aligned on the header row (a count, the corpus size). */
  aside?: ReactNode;
  /** Sits right after the title (a status tag). */
  marker?: ReactNode;
  /** Colour of the step number; the default is the muted ink. */
  stepClassName?: string;
}

/**
 * The header of one numbered parameter group: a mono step number, a title
 * that labels the group's control, an optional marker after the title and an
 * optional right-aligned aside.
 */
export function ParameterHeader({
  step,
  title,
  titleId,
  aside,
  marker,
  stepClassName = 'text-ink-muted',
}: ParameterHeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex items-baseline gap-2">
        <span className={cn('font-mono text-eyebrow', stepClassName)}>{step}</span>
        <h3 id={titleId} className="text-body font-semibold text-ink">
          {title}
        </h3>
        {marker}
      </div>
      {aside}
    </div>
  );
}

export interface ParameterColumnProps extends ParameterHeaderProps {
  children: ReactNode;
  hint?: ReactNode;
}

/**
 * One numbered column of the clustering parameter panel: a header, the
 * control, and an optional muted hint. The column fills its grid track; a
 * hairline rule separates it from the previous column (on top when stacked,
 * on the left in the row layout). The hint wraps to the track width.
 */
export function ParameterColumn({ children, hint, ...header }: ParameterColumnProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-hairline px-5 pt-4 pb-[18px] not-first:border-t min-[1024px]:not-first:border-t-0 min-[1024px]:not-first:border-l">
      <ParameterHeader {...header} />
      <div className="flex flex-col gap-2.5">{children}</div>
      {hint !== undefined && <p className="w-0 min-w-full text-label text-ink-muted">{hint}</p>}
    </div>
  );
}
