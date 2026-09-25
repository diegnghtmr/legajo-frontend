import { cn } from '../lib/cn';
import { Badge } from './ui/badge';
import { cardSurfaceClassName } from './ui/card';

export interface MetricTileProps {
  label: string;
  value: string;
  eyebrow?: string;
  /** True when this tile's value is the leader for the metrics strip's ranking rule. */
  leader?: boolean;
  /** Marker text for the leader, e.g. `Tree` / `Árbol` or `Partition` / `Partición`. */
  leaderLabel?: string;
}

/**
 * Eyebrow + mono value tile for the clustering metrics strip, on the shadcn
 * `Card` surface. The leader marker is a `Badge`, restyled with an ink
 * border and a smaller uppercase label instead of the primitive's own soft
 * pill treatment — this rare read-only marker predates the shadcn
 * primitives and keeps its own look on purpose.
 */
export function MetricTile({
  label,
  value,
  eyebrow,
  leader = false,
  leaderLabel = 'Leader',
}: MetricTileProps) {
  return (
    <div className={cn(cardSurfaceClassName, 'flex flex-col gap-1 p-3')}>
      {eyebrow && (
        <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {eyebrow}
        </p>
      )}
      <p className="text-label text-ink-secondary">{label}</p>
      <div className="flex items-center gap-2">
        <p className="font-mono text-mono text-ink">{value}</p>
        {leader && (
          <Badge className="rounded-sm border-ink px-1 py-0 text-[10px] font-semibold uppercase tracking-wide text-ink">
            {leaderLabel}
          </Badge>
        )}
      </div>
    </div>
  );
}
