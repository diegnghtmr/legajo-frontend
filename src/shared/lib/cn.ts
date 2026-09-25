import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

export type { ClassValue };

/**
 * tailwind-merge's default config only knows Tailwind's own scale names, so
 * every custom scale value this project's @theme (src/index.css) adds has
 * to be taught to it explicitly, or it gets misclassified:
 *
 * - Font size: @theme defines --text-display/-title/-body/-label/-eyebrow/
 *   -mono/-formula. Unregistered, tailwind-merge falls back to its generic
 *   text-color matcher for any `text-*` suffix it doesn't recognize — so a
 *   custom size combined with a real color (e.g. `text-label text-ink`)
 *   silently loses the size, the exact color always winning.
 * - Border radius: @theme defines --radius-none/-sm/-btn/-md/-lg/-full.
 *   `none`, `sm`, `md`, `lg` and `full` already match Tailwind's own scale;
 *   only `btn` is custom. Unregistered, `rounded-btn` isn't recognized as a
 *   radius utility at all, so it never conflict-resolves against another
 *   `rounded-*` class.
 *
 * Keep both lists in sync with @theme's `--text-*` and `--radius-*` entries.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'title', 'body', 'label', 'eyebrow', 'mono', 'formula'],
      radius: ['btn'],
    },
  },
});

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
