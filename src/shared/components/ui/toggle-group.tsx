import type { ComponentProps } from 'react';

import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';

import { cn } from '@/shared/lib/cn';

export type ToggleGroupProps = ComponentProps<typeof ToggleGroupPrimitive.Root>;

/**
 * Segmented control primitive: Radix `ToggleGroup` with `type="single"`
 * renders the WAI-ARIA radio-group pattern (`role="radiogroup"` on the
 * root, `role="radio"` + `aria-checked` on each item, roving tabindex)
 * rather than the toolbar `aria-pressed` pattern `type="multiple"` uses —
 * the same semantics the hand-built `SegmentedControl` already exposes.
 */
export function ToggleGroup({ className, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-hairline bg-paper-sunken p-[3px]',
        className,
      )}
      {...props}
    />
  );
}

export type ToggleGroupItemProps = ComponentProps<typeof ToggleGroupPrimitive.Item>;

export function ToggleGroupItem({ className, ...props }: ToggleGroupItemProps) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        'rounded-btn px-3 py-1.5 text-label font-medium text-ink-secondary motion-safe:transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-45',
        'data-[state=on]:bg-paper-raised data-[state=on]:text-ink data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]',
        'pointer-coarse:min-h-11 pointer-coarse:min-w-11',
        className,
      )}
      {...props}
    />
  );
}
