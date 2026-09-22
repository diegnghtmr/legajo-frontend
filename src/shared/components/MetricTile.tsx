export interface MetricTileProps {
  label: string;
  value: string;
  eyebrow?: string;
  /** True when this tile's value is the leader for the metrics strip's ranking rule (TRD §6.5). */
  leader?: boolean;
  /** Marker text for the leader, e.g. `Tree` / `Árbol` or `Partition` / `Partición` (DESIGN.md §6.4). */
  leaderLabel?: string;
}

/** Eyebrow + mono value tile for the clustering metrics strip (DESIGN.md §6.4, §9.3). */
export function MetricTile({
  label,
  value,
  eyebrow,
  leader = false,
  leaderLabel = 'Leader',
}: MetricTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-hairline bg-paper-raised p-3">
      {eyebrow && (
        <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {eyebrow}
        </p>
      )}
      <p className="text-label text-ink-secondary">{label}</p>
      <div className="flex items-center gap-2">
        <p className="font-mono text-mono text-ink">{value}</p>
        {leader && (
          <span className="rounded-sm border border-ink px-1 text-[10px] font-semibold uppercase tracking-wide text-ink">
            {leaderLabel}
          </span>
        )}
      </div>
    </div>
  );
}
