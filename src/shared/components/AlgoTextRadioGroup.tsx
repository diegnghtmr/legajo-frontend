import type { KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { Button } from './ui/button';

export interface AlgoTextRadioOption {
  id: string;
}

export interface AlgoTextRadioGroupProps {
  options: readonly AlgoTextRadioOption[];
  value: string;
  onChange: (id: string) => void;
  'aria-label'?: string;
}

/**
 * Single-select mono algorithm picker: the same visual as the multi-select
 * `AlgoTextList` (`AlgoTextButton`'s `mono` variant — ink-secondary text,
 * active = ink with a 1.5px ink bottom border), but wired as a WAI-ARIA
 * radiogroup (`role="radiogroup"` + `role="radio"`/`aria-checked`, exactly
 * one option selected) instead of an independent toggle-button group. The
 * N×N similarity matrix's algorithm picker needs this exact combination —
 * the locked mono-text-button pattern, but a single, not independent,
 * choice — which neither existing sibling covers: `SegmentedControl` is
 * already a radiogroup but renders the boxed/pill track, and `AlgoTextList`
 * is already the mono pattern but renders an `aria-pressed` toggle group.
 *
 * Arrow-key/Home/End move focus AND select (a native radio group's
 * contract), mirroring `SegmentedControl`'s own capture-phase keydown
 * handling: entering the group by Tab, or a plain programmatic `.focus()`,
 * never selects anything by itself. Right/Down move forward and Left/Up move
 * backward, both wrapping at the ends, per the WAI-ARIA radio group pattern
 * (this list lays out horizontally, but Up/Down are still handled the same
 * as Left/Right — the pattern does not condition them on orientation).
 */
export function AlgoTextRadioGroup({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: AlgoTextRadioGroupProps) {
  const matchedIndex = options.findIndex((option) => option.id === value);
  const currentIndex = matchedIndex === -1 ? 0 : matchedIndex;

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const moveTo = (index: number) => {
      const option = options[index];
      if (!option) return;
      onChange(option.id);
      const items = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      items[index]?.focus();
    };

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        moveTo((currentIndex + 1) % options.length);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        moveTo((currentIndex - 1 + options.length) % options.length);
        break;
      case 'Home':
        event.preventDefault();
        event.stopPropagation();
        moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        event.stopPropagation();
        moveTo(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDownCapture={handleKeyDownCapture}
      className="flex flex-wrap items-center gap-4"
    >
      {options.map((option, index) => {
        const isActive = option.id === value;
        return (
          <Button
            key={option.id}
            variant="mono"
            role="radio"
            aria-checked={isActive}
            tabIndex={index === currentIndex ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={cn(isActive && 'border-ink text-ink')}
          >
            {option.id}
          </Button>
        );
      })}
    </div>
  );
}
