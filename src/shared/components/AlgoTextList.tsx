import type { AlgoFamily } from '../family';
import { AlgoTextButton } from './AlgoTextButton';

export interface AlgoOption {
  id: string;
  family: AlgoFamily;
}

export interface AlgoTextListProps {
  options: readonly AlgoOption[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  'aria-label'?: string;
}

/** Horizontal wrap of `AlgoTextButton`s (DESIGN.md §6.2, §9.3). */
export function AlgoTextList({
  options,
  selectedIds,
  onToggle,
  'aria-label': ariaLabel,
}: AlgoTextListProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-4">
      {options.map((option) => (
        <AlgoTextButton
          key={option.id}
          id={option.id}
          family={option.family}
          active={selectedIds.includes(option.id)}
          onToggle={() => onToggle(option.id)}
        />
      ))}
    </div>
  );
}
