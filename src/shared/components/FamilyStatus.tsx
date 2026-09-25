import type { AlgoFamily } from '../family';
import { cn } from '../lib/cn';

export interface FamilyStatusProps {
  family: AlgoFamily;
  label: string;
  /** Visually hides the text label for a compact row (the mobile results
   * list's "family dot", DESIGN §6.7) while keeping it in the accessible
   * tree — the dot alone is still never the only channel, only the one a
   * sighted person sees painted. */
  hideLabel?: boolean;
}

/**
 * Read-only family indicator for table rows:
 * a 6px status dot plus a visible text label — the dot alone is never the
 * only channel.
 */
export function FamilyStatus({ family, label, hideLabel = false }: FamilyStatusProps) {
  return (
    <span className="inline-flex items-center gap-2 text-label text-ink-secondary">
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-[6px] w-[6px] rounded-full',
          family === 'classic' ? 'bg-classic' : 'bg-ai',
        )}
      />
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
    </span>
  );
}
