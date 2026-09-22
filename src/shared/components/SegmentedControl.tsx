import type { KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';

import { cn } from '../lib/cn';

export interface SegmentedOption<TValue extends string> {
  value: TValue;
  /**
   * A plain string for most Segmented uses (e.g. the family filter); a
   * `ReactNode` is accepted so a caller needing a mono machine id inside an
   * option (DESIGN.md's "always mono for machine ids") can wrap it, e.g. the
   * similarity matrix's single-algorithm selector.
   */
  label: ReactNode;
}

export interface SegmentedControlProps<TValue extends string> {
  options: readonly SegmentedOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * DESIGN.md pattern B family/representation switch (§7.1, §7.6): a
 * `radiogroup` track of `radio` options with roving tabindex and
 * ArrowLeft/ArrowRight/Home/End navigation, wrapping at the ends.
 */
export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SegmentedControlProps<TValue>) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectByIndex = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    optionRefs.current[index]?.focus();
  };

  // With no matching value the first option stands in, so the group stays reachable and
  // operable by keyboard (WAI-ARIA radiogroup pattern).
  const matchedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = matchedIndex === -1 ? 0 : matchedIndex;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = focusIndex;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        selectByIndex((currentIndex + 1) % options.length);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        selectByIndex((currentIndex - 1 + options.length) % options.length);
        break;
      case 'Home':
        event.preventDefault();
        selectByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        selectByIndex(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onKeyDown={handleKeyDown}
      className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-paper-sunken p-[3px]"
    >
      {options.map((option, index) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            ref={(node) => {
              optionRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-btn px-3 py-1.5 text-label font-medium text-ink-secondary transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              isActive && 'bg-paper-raised text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
