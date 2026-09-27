import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * Placeholder block for a region whose data has not arrived yet: a plain
 * `hairline` fill on `rounded-sm`, pulsing only under
 * `prefers-reduced-motion: no-preference` (the same `motion-safe:` idiom
 * `Button` already uses for its color transition). Always `aria-hidden`,
 * since the loading state's accessible name lives on a sibling `role="status"`
 * sentence, never on the block itself — composed into one skeleton per
 * region by the caller, sized and counted to mirror that region's real
 * layout.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('rounded-sm bg-hairline motion-safe:animate-pulse', className)}
      {...props}
    />
  );
}
