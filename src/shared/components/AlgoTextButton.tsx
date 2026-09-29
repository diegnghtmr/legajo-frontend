import { Check } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button } from './ui/button';

export interface AlgoTextButtonProps {
  id: string;
  active: boolean;
  onToggle: () => void;
  /** Precede the id with a decorative tick box so a list of them reads as a multi-select. */
  tick?: boolean;
}

/**
 * Mono, selectable algorithm id (the `mono` `Button` variant): ink-secondary
 * text, active = ink with a 1.5px ink bottom border. It carries no family colour, so
 * nothing here depends on colour alone; family is shown by the Segmented filter and by
 * `FamilyStatus` in read-only views.
 */
export function AlgoTextButton({ id, active, onToggle, tick = false }: AlgoTextButtonProps) {
  return (
    <Button
      variant="mono"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(tick && 'gap-1.5', active && 'border-ink text-ink')}
    >
      {tick && (
        <span
          data-tick
          aria-hidden="true"
          className={cn(
            'inline-flex size-2.5 shrink-0 items-center justify-center rounded-[2px] border',
            active ? 'border-ink bg-ink text-paper' : 'border-hairline-strong',
          )}
        >
          {active && <Check className="size-2" strokeWidth={4} />}
        </span>
      )}
      {id}
    </Button>
  );
}
