import { Check } from 'lucide-react';

import { cn } from '../../shared/lib/cn';

export interface LinkageToggleProps {
  /** The linkage id, shown in mono and used as the accessible name. */
  id: string;
  selected: boolean;
  onToggle: () => void;
}

/**
 * One boxed linkage toggle: a 36px button (44px on a coarse pointer) with
 * the mono id on the left and a decorative checkbox on the right. Selected =
 * ink border and an ink checkbox holding a check; unselected = hairline
 * border, secondary text and an empty checkbox. Multi-select, so it is a
 * toggle button (`aria-pressed`), not a radio.
 */
export function LinkageToggle({ id, selected, onToggle }: LinkageToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'flex h-9 min-w-0 items-center justify-between gap-1.5 rounded-btn border bg-paper-raised px-2.5 text-left hover:bg-paper-sunken pointer-coarse:min-h-11',
        'motion-safe:transition-[color,background-color,border-color,transform] motion-safe:duration-(--dur-fast) motion-safe:ease-standard motion-safe:active:scale-(--press-scale) motion-safe:active:duration-(--dur-instant)',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        selected ? 'border-ink text-ink' : 'border-hairline-strong text-ink-secondary',
      )}
    >
      <span className="truncate font-mono text-mono">{id}</span>
      <span
        data-tick
        aria-hidden="true"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-sm border motion-safe:transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-hairline-strong bg-paper-raised',
        )}
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

export interface LinkageToggleGroupProps {
  ids: readonly string[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  'aria-label'?: string;
}

/** The linkage toggles in equal columns: four from 640px, two below. */
export function LinkageToggleGroup({
  ids,
  selectedIds,
  onToggle,
  'aria-label': ariaLabel,
}: LinkageToggleGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4"
    >
      {ids.map((id) => (
        <LinkageToggle
          key={id}
          id={id}
          selected={selectedIds.includes(id)}
          onToggle={() => onToggle(id)}
        />
      ))}
    </div>
  );
}
