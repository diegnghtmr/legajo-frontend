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
