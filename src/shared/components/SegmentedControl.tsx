import type { KeyboardEvent, ReactNode } from 'react';

import { cn } from '../lib/cn';
import {
  TOGGLE_GROUP_CLASS_NAME,
  TOGGLE_GROUP_ITEM_CLASS_NAME,
  ToggleGroup,
  ToggleGroupItem,
} from './ui/toggle-group';

export interface SegmentedOption<TValue extends string> {
  value: TValue;
  /**
   * A plain string for most Segmented uses (e.g. the family filter); a
   * `ReactNode` is accepted so a caller needing a mono machine id inside an
   * option (machine ids are always shown in mono) can wrap it, e.g. the
   * similarity matrix's single-algorithm selector.
   */
  label: ReactNode;
  /** The option's own language when its label is not in the page's language
   * (the language switch shows each language by its autonym). */
  lang?: string;
}

export interface SegmentedControlProps<TValue extends string> {
  options: readonly SegmentedOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** `sm` tightens the option padding for a control that sits inside a
   * compact column or a card header; the track and semantics are the same. */
  size?: SegmentedSize;
}

export type SegmentedSize = 'default' | 'sm';

/** The option padding of each size, exported so a skeleton can mirror it. */
export const SEGMENTED_ITEM_SIZE_CLASS_NAMES: Record<SegmentedSize, string> = {
  default: '',
  sm: 'px-2.5 py-1',
};

/**
 * Pattern B family/representation switch, the shadcn/Radix `ToggleGroup`
 * (`type="single"`) restyled for markup, ARIA and styling only: role,
 * `aria-checked`, hover/active surface, focus ring and disabled state all
 * come from Radix. Its own arrow-key/Home/End handling is replaced here to
 * restore the exact contract the previous hand-rolled implementation had —
 * a native `<input type="radio">` group's "select follows an explicit key
 * press" behavior, not "select follows focus":
 *
 * - ArrowLeft/ArrowRight/Home/End both move focus AND select the newly
 *   focused option, wrapping at the ends.
 * - Entering the group by Tab, or a plain programmatic `.focus()`, never
 *   selects anything by itself.
 *
 * The keydown listener runs on the capture phase, before Radix's own
 * per-item roving-focus keydown handler, and `stopPropagation`s on the keys
 * it handles so Radix never also moves focus for the same key press (which
 * would otherwise move it twice, or move it without going through
 * `onChange`). `onValueChange` still ignores an empty `next` (Radix reports
 * it when the pressed item is clicked again), so the group always keeps
 * exactly one option selected, as a radiogroup requires.
 */
export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  size = 'default',
}: SegmentedControlProps<TValue>) {
  const matchedIndex = options.findIndex((option) => option.value === value);
  const currentIndex = matchedIndex === -1 ? 0 : matchedIndex;

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const moveTo = (index: number) => {
      const option = options[index];
      if (!option) return;
      onChange(option.value);
      const items = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      items[index]?.focus();
    };

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        moveTo((currentIndex + 1) % options.length);
        break;
      case 'ArrowLeft':
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
    <ToggleGroup
      type="single"
      orientation="horizontal"
      loop
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        onChange(next as TValue);
      }}
      onKeyDownCapture={handleKeyDownCapture}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          lang={option.lang}
          className={SEGMENTED_ITEM_SIZE_CLASS_NAMES[size]}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export interface SegmentedControlSkeletonProps {
  /** One label per option, in order (the option that will be checked included). */
  labels: readonly ReactNode[];
  size?: SegmentedSize;
}

/**
 * The box of a `SegmentedControl` before its options are known: the same
 * track and option classes, with plain non-interactive labels, so swapping it
 * for the real control causes no layout shift. Holds nothing focusable.
 */
export function SegmentedControlSkeleton({
  labels,
  size = 'default',
}: SegmentedControlSkeletonProps) {
  return (
    <div className={cn(TOGGLE_GROUP_CLASS_NAME, 'self-start')}>
      {labels.map((label, index) => (
        <span
          key={index}
          className={cn(
            TOGGLE_GROUP_ITEM_CLASS_NAME,
            'pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center',
            SEGMENTED_ITEM_SIZE_CLASS_NAMES[size],
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
