import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type { ClassValue };

/**
 * Class-name joiner used across the app and by the shadcn/ui primitives in
 * `shared/components/ui/`: `clsx` collects and flattens the truthy inputs,
 * `tailwind-merge` then resolves conflicting Tailwind utilities for the same
 * CSS property (e.g. a caller's `px-4` overriding a component's own `px-2`)
 * by keeping only the last one, the way shadcn/ui's own `cn()` does.
 */
export function cn(...values: readonly ClassValue[]): string {
  return twMerge(clsx(values));
}
