import { cn } from '../lib/cn';

export interface AlgoTextButtonProps {
  id: string;
  active: boolean;
  onToggle: () => void;
}

/**
 * Mono, selectable algorithm id (DESIGN.md §6 `algo-text-button`, §9.3): ink-secondary
 * text, active = ink with a 1.5px ink bottom border. It carries no family colour, so
 * nothing here depends on colour alone; family is shown by the Segmented filter and by
 * `FamilyStatus` in read-only views.
 */
export function AlgoTextButton({ id, active, onToggle }: AlgoTextButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'border-b-[1.5px] border-transparent py-1 font-mono text-mono text-ink-secondary transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        active && 'border-ink text-ink',
      )}
    >
      {id}
    </button>
  );
}
