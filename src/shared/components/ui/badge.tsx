import type { ComponentProps } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/shared/lib/cn';

/**
 * Badge primitive. `classic`/`ai` are the app's family signal colors, kept
 * as the rare soft-badge pairing (`classic-foreground` on `classic-soft`,
 * `ai-foreground` on `ai-soft`) — never used as page chrome or as a
 * stand-in for the primary button.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-label font-medium',
  {
    variants: {
      variant: {
        default: 'border border-hairline-strong bg-paper-raised text-ink-secondary',
        classic: 'bg-classic-soft text-classic-foreground',
        ai: 'bg-ai-soft text-ai-foreground',
        // Read-only hatched tag (`aplicado`, `k = 3`): mono text on a
        // paper-sunken hatch with a hairline-strong ring, no family color.
        marker:
          'h-5 rounded-sm py-0 pr-[7px] pl-[5px] font-mono text-[10.5px] font-normal text-ink-secondary bg-[repeating-linear-gradient(135deg,var(--color-paper-sunken)_0_3px,var(--color-paper-raised)_3px_6px)] shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
