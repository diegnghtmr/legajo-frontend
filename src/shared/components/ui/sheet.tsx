import type { ComponentProps } from 'react';

import { Dialog as DialogPrimitive } from 'radix-ui';

import { cn } from '@/shared/lib/cn';

export type SheetProps = ComponentProps<typeof DialogPrimitive.Root>;

/**
 * Modal dialog primitive (shadcn/ui `Sheet`, Radix `Dialog`) for narrow
 * widths, where a `WorkbenchLayout` consumer has nowhere to dock its
 * `detail` region: full-height, focus-trapped while open, closes on `Esc`
 * or the overlay, and moves focus into itself on open. `SheetContent`'s
 * children keep their own close button (already wired to the same close
 * handler the docked panel uses) instead of this primitive adding a second
 * one.
 */
export function Sheet(props: SheetProps) {
  return <DialogPrimitive.Root {...props} />;
}

export interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** The dialog's accessible name (Radix requires a `Dialog.Title`).
   * Visually hidden by default since the content passed as `children`
   * already renders its own visible heading — this exists only so the
   * dialog has a name, never as a second, differently-styled title. */
  title: string;
  hideTitle?: boolean;
  /** 'right' (default): a full-height panel sliding in from the right edge
   * — the trace and article-abstract sheets. 'bottom': docked to the
   * viewport's bottom edge, bounded to 85dvh with its own scroll and
   * safe-area bottom padding — the corpus-list sheet the selection tray
   * opens. */
  side?: 'right' | 'bottom';
}

export function SheetContent({
  title,
  hideTitle = true,
  side = 'right',
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col overflow-y-auto bg-paper-raised shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-lg border-t border-hairline pb-[env(safe-area-inset-bottom)]'
            : 'inset-y-0 right-0 h-full w-full border-l border-hairline sm:max-w-md',
          className,
        )}
        {...props}
      >
        {/* `asChild` renders this as a plain `<span>` rather than Radix's
         * default `<h2>`, so a visually-hidden title never doubles up on
         * the "heading" role next to the content's own real heading —
         * `aria-labelledby` still wires it to `Content` either way. */}
        <DialogPrimitive.Title asChild>
          <span className={hideTitle ? 'sr-only' : undefined}>{title}</span>
        </DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
