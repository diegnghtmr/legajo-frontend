import type { ReactNode } from 'react';

import { Skeleton } from '../../../shared/components/ui/skeleton';

export interface TraceFieldSkeletonProps {
  /** Always real, translated text: every trace field's own label is fixed
   * chrome, never response data, so it renders immediately instead of
   * hiding behind a placeholder bar of its own. */
  label: ReactNode;
  /** `2` reserves a second line for a value already known to wrap at this
   * grid's own column width (e.g. a vector excerpt or a long model id). */
  valueLines?: 1 | 2;
  className?: string;
}

/**
 * One label/value pair for a trace panel's own `dl`, mirroring `Field`'s box
 * (`EmbeddingLocalTracePanel`/`EmbeddingApiTracePanel`) so the swap to real
 * data causes no shift: the real `dt` text immediately (never a bar — it is
 * fixed chrome, not response data) over one or two placeholder value bars.
 */
export function TraceFieldSkeleton({ label, valueLines = 1, className }: TraceFieldSkeletonProps) {
  return (
    <div className={className}>
      <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
        {label}
      </dt>
      <dd className="flex flex-col gap-1">
        <Skeleton className="h-3 w-28" />
        {valueLines === 2 && <Skeleton className="h-3 w-20" />}
      </dd>
    </div>
  );
}
