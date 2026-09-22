import type { AlgoFamily } from '../family';
import { cn } from '../lib/cn';

export interface AlgoTextButtonProps {
  id: string;
  family: AlgoFamily;
  active: boolean;
  onToggle: () => void;
}

const FAMILY_GLYPH: Record<AlgoFamily, string> = {
  classic: 'C',
  ai: 'AI',
};

const FAMILY_SR_LABEL: Record<AlgoFamily, string> = {
  classic: 'Classic algorithm',
  ai: 'AI algorithm',
};

/**
 * Mono, selectable algorithm id (DESIGN.md §7.1/§9.3). Family membership is
 * never color-only (§7.6): a visible glyph plus matched sr-only text carry
 * it alongside the family color tint.
 */
export function AlgoTextButton({ id, family, active, onToggle }: AlgoTextButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1 border-b-[1.5px] border-transparent pb-1 font-mono text-mono text-ink-secondary transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        active && 'border-ink text-ink',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          family === 'classic' ? 'text-classic' : 'text-ai',
        )}
      >
        {FAMILY_GLYPH[family]}
      </span>
      <span className="sr-only">{FAMILY_SR_LABEL[family]}</span>
      {id}
    </button>
  );
}
