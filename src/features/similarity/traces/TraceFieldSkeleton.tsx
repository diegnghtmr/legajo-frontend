import type { ReactNode } from 'react';

import { Skeleton } from '../../../shared/components/ui/skeleton';

export interface TraceFieldSkeletonProps {
  /** Always real, translated text: every trace field's own label is fixed
   * chrome, never response data, so it renders immediately instead of
   * hiding behind a placeholder bar of its own. */
  label: ReactNode;
  /**
   * A representative real value for this field (e.g. eight comma-joined
   * placeholder numbers for a vector excerpt, or a typical model id),
   * rendered as an invisible sizer under a `Skeleton` overlay — the same
   * "invisible sizer" technique the clustering metrics header and the
   * Jaccard token-list skeletons already use. Whether a field like this
   * actually wraps onto a second line depends on the viewport's own
   * current width (the grid column narrows well before the value itself
   * changes), so a fixed line count either overshoots at a wide viewport
   * or falls short at a narrow one; letting the browser wrap this
   * placeholder the same way it would wrap the real value reproduces
   * either box exactly, at every width, without guessing which one this
   * render is.
   */
  typicalValue?: string;
  /** `2` reserves a fixed second line, only for a value with no realistic
   * `typicalValue` stand-in (mutually exclusive with it). */
  valueLines?: 1 | 2;
  className?: string;
}

/**
 * One label/value pair for a trace panel's own `dl`, mirroring `Field`'s box
 * (`EmbeddingLocalTracePanel`/`EmbeddingApiTracePanel`) so the swap to real
 * data causes no shift: the real `dt` text immediately (never a bar — it is
 * fixed chrome, not response data) over a placeholder value.
 */
export function TraceFieldSkeleton({
  label,
  typicalValue,
  valueLines = 1,
  className,
}: TraceFieldSkeletonProps) {
  return (
    <div className={className}>
      <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
        {label}
      </dt>
      <dd>
        {typicalValue !== undefined ? (
          <div className="relative break-words font-mono text-mono">
            <span aria-hidden="true" className="invisible">
              {typicalValue}
            </span>
            <Skeleton className="absolute inset-0" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* `h-[18px]`, not the `text-mono` role's own 12px nominal size:
             * a real mono value line's own line-height, at this font
             * stack's own metrics, measures noticeably taller (verified
             * live against the running app) — a shorter bar left this
             * field short of the real one, invisible while every caller
             * kept it inside a bounded viewport but visible on the
             * full-screen trace view. */}
            <Skeleton className="h-[18px] w-28" />
            {valueLines === 2 && <Skeleton className="h-[18px] w-20" />}
          </div>
        )}
      </dd>
    </div>
  );
}
