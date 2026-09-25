import type { ComponentProps } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/shared/lib/cn';

/**
 * Ink fill for the primary variant, paper fill with a hairline border for
 * secondary, one `label` typography, `rounded-btn`, and the fixed 36px
 * height the design system's button spec uses. `mono` is the algorithm-pick
 * pattern: mono selectable text with no button chrome —
 * a caller-supplied `className` carries the active state (ink text + a 1.5px
 * ink bottom border), since that state lives outside this primitive's own
 * variant axis. Its invisible `pointer-coarse:before:` pseudo-element widens
 * the tap target to 44px without inflating the visible text box, the same
 * technique `Checkbox` already uses.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary:
          'h-9 rounded-btn px-4 py-2 text-label font-medium bg-primary text-primary-foreground hover:opacity-90 pointer-coarse:min-h-11 pointer-coarse:min-w-11',
        secondary:
          'h-9 rounded-btn border border-hairline-strong bg-paper-raised px-4 py-2 text-label font-medium text-ink hover:bg-paper-sunken pointer-coarse:min-h-11 pointer-coarse:min-w-11',
        // `before:bottom-[-11.5px]`, not `-10px` on every side: this
        // variant's own bottom border (`border-b-[1.5px]`) sits *inside*
        // its `getBoundingClientRect()` box on that one edge only (browsers
        // resolve an absolutely positioned pseudo's own `inset` against its
        // containing block's padding box, not the border box that includes
        // that 1.5px) — a plain `-10px` on every side reaches only 8.5px on
        // the bottom, 1.5px short.
        mono: "relative h-auto w-auto justify-start gap-0 rounded-none border-b-[1.5px] border-transparent px-0 py-1 font-mono text-mono font-normal text-ink-secondary hover:text-ink pointer-coarse:before:absolute pointer-coarse:before:inset-[-10px] pointer-coarse:before:bottom-[-11.5px] pointer-coarse:before:content-['']",
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

export interface ButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

/** Button primitive (shadcn/ui, Radix `Slot`-free): restyled to Paper & Ink. */
export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}
