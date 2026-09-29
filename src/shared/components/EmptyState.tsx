import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

export interface EmptyStateProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** A short mono line, such as `0 / 4`. Decorative, so hidden from assistive technology. */
  glyph?: string;
  title: ReactNode;
  /** The reason nothing is shown, or the next step. */
  reason?: ReactNode;
  /** A quiet or secondary button or link, after the text. */
  action?: ReactNode;
  /** Renders the title as a heading of this level instead of a paragraph. */
  headingLevel?: 2 | 3 | 4;
}

/**
 * The state of a region with nothing to show: a hatched hairline well with an
 * optional mono glyph, a title and the reason or next step. It is text, not a
 * control; an action, when there is one, sits after it.
 */
export function EmptyState({
  glyph,
  title,
  reason,
  action,
  headingLevel,
  className,
  ...props
}: EmptyStateProps) {
  const Title = headingLevel ? (`h${headingLevel}` as const) : 'p';

  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-start gap-1.5 rounded-md bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0_/_0.018)_6px_12px)] p-4 shadow-[inset_0_0_0_1px_var(--color-hairline)]',
        className,
      )}
      {...props}
    >
      {glyph && (
        <p aria-hidden="true" className="font-mono text-eyebrow tracking-[0.08em] text-ink-muted">
          {glyph}
        </p>
      )}
      <Title className="text-body font-medium text-ink">{title}</Title>
      {reason !== undefined && <p className="text-label text-ink-muted">{reason}</p>}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}
