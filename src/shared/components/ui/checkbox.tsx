import type { ComponentProps } from 'react';

import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { CheckIcon } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

export type CheckboxProps = ComponentProps<typeof CheckboxPrimitive.Root>;

/**
 * Checkbox primitive (Radix `Checkbox`): hairline-strong border when
 * unchecked, ink fill with a paper check mark when checked, 2px ink focus
 * ring — the same focus treatment as every other interactive control.
 */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm border border-hairline-strong bg-paper-raised transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-primary-foreground">
        <CheckIcon className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
