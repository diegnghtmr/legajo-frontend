import type { ComponentProps, ReactNode } from 'react';

import { Check, CircleX, Info, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

export type AlertTone = 'danger' | 'warning' | 'info' | 'success' | 'offline';

interface ToneSpec {
  Icon: LucideIcon;
  /** Tile fill and icon color: the tone lives here and nowhere else. */
  tileClassName: string;
  /** `alert` interrupts assistive technology; `status` waits its turn. */
  role: 'alert' | 'status';
}

const TONES: Record<AlertTone, ToneSpec> = {
  danger: { Icon: CircleX, tileClassName: 'bg-danger-soft text-danger', role: 'alert' },
  warning: { Icon: TriangleAlert, tileClassName: 'bg-warning-soft text-warning', role: 'alert' },
  info: { Icon: Info, tileClassName: 'bg-paper-sunken text-ink', role: 'status' },
  success: { Icon: Check, tileClassName: 'bg-success-soft text-success', role: 'status' },
  offline: { Icon: WifiOff, tileClassName: 'bg-paper-sunken text-ink', role: 'status' },
};

export interface AlertProps extends Omit<ComponentProps<'div'>, 'title' | 'role'> {
  tone: AlertTone;
  /** What happened, first. */
  title: ReactNode;
  /** Why it happened, or what to do next. */
  body?: ReactNode;
  /** Short mono facts, such as the endpoint and the HTTP status. */
  meta?: readonly string[];
  /** A secondary button, typically a retry. */
  action?: ReactNode;
}

/**
 * Feedback card for a region that failed or has something to report: a
 * tinted icon tile, a title that says what happened, an optional body that
 * says why, and an optional footer with a mono meta line and an action. Sits
 * in the region it describes and replaces only that region's content. The
 * card is always `paper-raised` with a hairline ring; only the tile carries
 * the tone, and the icon is decorative since the title carries the meaning.
 */
export function Alert({ tone, title, body, meta, action, className, ...props }: AlertProps) {
  const { Icon, tileClassName, role } = TONES[tone];
  const hasFooter = (meta?.length ?? 0) > 0 || action !== undefined;

  return (
    <div
      role={role}
      data-slot="alert"
      data-tone={tone}
      className={cn(
        'enter-rise grid grid-cols-[32px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-md bg-paper-raised py-3.5 pr-3.5 pl-3 shadow-[inset_0_0_0_1px_var(--color-hairline),var(--shadow-card)]',
        className,
      )}
      {...props}
    >
      <div
        data-slot="alert-tile"
        className={cn(
          'row-span-2 flex size-8 items-center justify-center rounded-btn',
          tileClassName,
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </div>
      <p className="col-start-2 text-body font-semibold leading-[1.4] text-ink">{title}</p>
      {body !== undefined && (
        <p className="col-start-2 text-[13px] leading-normal text-ink-secondary">{body}</p>
      )}
      {hasFooter && (
        <div
          data-slot="alert-foot"
          className="col-start-2 mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-dashed border-hairline pt-2.5"
        >
          {meta && meta.length > 0 && (
            <p className="flex flex-wrap gap-x-3 gap-y-1.5 font-mono text-eyebrow text-ink-muted">
              {meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </p>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
