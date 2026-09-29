import type { AlgoFamily } from '../family';
import { AlgoTextButton } from './AlgoTextButton';

/**
 * `family` lets callers filter the list with the family Segmented; it is not
 * rendered. Optional because not every `AlgoTextList` consumer has a family
 * concept — the clustering linkage selection (single/complete/average/ward)
 * has no family Segmented, so it omits it entirely.
 */
export interface AlgoOption {
  id: string;
  family?: AlgoFamily;
}

export interface AlgoTextListProps {
  options: readonly AlgoOption[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  'aria-label'?: string;
  /** Precede each id with a decorative tick box (multi-select reading). */
  withTick?: boolean;
}

/** Horizontal wrap of `AlgoTextButton`s. */
export function AlgoTextList({
  options,
  selectedIds,
  onToggle,
  'aria-label': ariaLabel,
  withTick = false,
}: AlgoTextListProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      // `gap-y-6` (24px), not `gap-y-4`: `AlgoTextButton`'s own invisible
      // pointer-coarse hit-area extension reaches about 10px above and
      // below its own visible box (to clear 44px total height on a much
      // shorter mono line) — at `gap-4` (16px) between wrapped rows, two
      // adjacent rows' own extensions overlapped by several px, so a real
      // tap near a row's own lower edge could resolve to the next row's
      // button instead. Horizontal spacing (`gap-x-4`) is untouched: this
      // list's buttons are wide enough (mono ids, several characters) that
      // their own visible width already clears 44px well before reaching
      // into that extension, so there is no equivalent collision sideways.
      className="flex flex-wrap items-center gap-x-4 gap-y-6"
    >
      {options.map((option) => (
        <AlgoTextButton
          key={option.id}
          id={option.id}
          active={selectedIds.includes(option.id)}
          tick={withTick}
          onToggle={() => onToggle(option.id)}
        />
      ))}
    </div>
  );
}
