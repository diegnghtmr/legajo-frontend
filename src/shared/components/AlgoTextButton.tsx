import { cn } from '../lib/cn';
import { Button } from './ui/button';

export interface AlgoTextButtonProps {
  id: string;
  active: boolean;
  onToggle: () => void;
}

/**
 * Mono, selectable algorithm id (the `mono` `Button` variant): ink-secondary
 * text, active = ink with a 1.5px ink bottom border. It carries no family colour, so
 * nothing here depends on colour alone; family is shown by the Segmented filter and by
 * `FamilyStatus` in read-only views.
 */
export function AlgoTextButton({ id, active, onToggle }: AlgoTextButtonProps) {
  return (
    <Button
      variant="mono"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(active && 'border-ink text-ink')}
    >
      {id}
    </Button>
  );
}
