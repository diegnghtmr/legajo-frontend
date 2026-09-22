import type { AlgoFamily } from '../family';
import { cn } from '../lib/cn';

export interface FamilyStatusProps {
  family: AlgoFamily;
  label: string;
}

/**
 * Read-only family indicator for table rows (DESIGN.md §6.2, §7.1, §7.6):
 * a 6px status dot plus a visible text label — the dot alone is never the
 * only channel.
 */
export function FamilyStatus({ family, label }: FamilyStatusProps) {
  return (
    <span className="inline-flex items-center gap-2 text-label text-ink-secondary">
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-[6px] w-[6px] rounded-full',
          family === 'classic' ? 'bg-classic' : 'bg-ai',
        )}
      />
      {label}
    </span>
  );
}
