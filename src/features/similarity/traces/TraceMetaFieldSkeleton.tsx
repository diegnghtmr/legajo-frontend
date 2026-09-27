import type { ReactNode } from 'react';

import { Skeleton } from '../../../shared/components/ui/skeleton';

export interface TraceMetaFieldSkeletonProps {
  /** Always real, translated text — every meta field's own label (Familia,
   * Valor crudo, Puntaje, Camino óptimo) is fixed chrome, never response
   * data, so it renders immediately instead of hiding behind a bar. */
  label: ReactNode;
  /** `mono` for a numeric value (raw value, score, optimal path); the
   * plain body role for the family name. */
  valueVariant?: 'mono' | 'body';
}

/**
 * One field of `TraceDetailPanel`'s own meta `dl` while its value is still
 * pending: the real label immediately, a placeholder bar only for the
 * value — the same box the field takes on once its own fetch resolves.
 */
export function TraceMetaFieldSkeleton({
  label,
  valueVariant = 'mono',
}: TraceMetaFieldSkeletonProps) {
  return (
    <div>
      <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
        {label}
      </dt>
      <dd>
        {/* The real value's own line-height, at this font stack's own
         * metrics — measured against the running app: `text-mono
         * font-semibold` (18px) and `text-body font-semibold` (21px), both
         * taller than either role's own nominal font size (12px/14px). A
         * shorter bar left this field short of the real one, invisible
         * while every caller kept it inside a bounded viewport (the docked
         * trace panel), but visible once the full-screen trace view (no
         * such bound) reserves this same row. */}
        <Skeleton className={valueVariant === 'mono' ? 'h-[18px] w-10' : 'h-[21px] w-16'} />
      </dd>
    </div>
  );
}
