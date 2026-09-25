import type { ComponentProps } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/shared/lib/cn';

/**
 * Ink fill for the primary variant, paper fill with a hairline border for
 * secondary, one `label` typography, `rounded-btn`, and the fixed 36px
 * height the design system's button spec uses.
 */
const buttonVariants = cva(
  'inline-flex h-9 items-center justify-center gap-2 rounded-btn px-4 py-2 text-label font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'border border-hairline-strong bg-paper-raised text-ink hover:bg-paper-sunken',
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
