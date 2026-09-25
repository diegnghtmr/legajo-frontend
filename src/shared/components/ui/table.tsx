import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

export interface TableProps extends ComponentProps<'table'> {
  /**
   * Skip this primitive's own `overflow-x-auto` wrapper div. Defaults to
   * `true` (wrapped). Set to `false` when the caller supplies its own
   * single scroll container instead — nesting two `overflow` ancestors
   * (this wrapper inside a caller's own scrolling div) makes `position:
   * sticky` cells/headers stick to whichever one actually scrolls, which is
   * not reliably the caller's outer container, breaking sticky headers and
   * sticky first columns on a scrollable matrix.
   */
  wrap?: boolean;
}

/** Table primitives: eyebrow header on `paper-sunken`, mono numeric columns left to callers. */
export function Table({ className, wrap = true, ...props }: TableProps) {
  const table = <table className={cn('w-full border-collapse text-body', className)} {...props} />;

  if (!wrap) {
    return table;
  }

  return <div className="w-full overflow-x-auto">{table}</div>;
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-paper-sunken', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={className} {...props} />;
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return <tfoot className={cn('border-t border-hairline bg-paper-sunken', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('border-b border-hairline last:border-0', className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'p-3 text-left text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('p-3 align-middle text-ink', className)} {...props} />;
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return <caption className={cn('mt-3 text-label text-ink-muted', className)} {...props} />;
}
