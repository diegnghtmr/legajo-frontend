import type { ReactNode } from 'react';

import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

export interface SegmentedOption<TValue extends string> {
  value: TValue;
  /**
   * A plain string for most Segmented uses (e.g. the family filter); a
   * `ReactNode` is accepted so a caller needing a mono machine id inside an
   * option (machine ids are always shown in mono) can wrap it, e.g. the
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
 * Pattern B family/representation switch, the shadcn/Radix `ToggleGroup`
 * (`type="single"`) restyled: the radiogroup/radio markup, roving tabindex
 * and Home/End/Arrow-key focus movement all come from Radix. Radix's own
 * keyboard model only moves focus on arrow keys — unlike a native
 * `<input type="radio">` group, it does not also select the newly focused
 * item — so each option selects itself on focus, mirroring the native
 * radiogroup "select follows focus" behavior that both arrow-key navigation
 * and click rely on. `onValueChange` still ignores an empty `next` (Radix
 * reports it when the pressed item is clicked again), so the group always
 * keeps exactly one option selected, as a radiogroup requires.
 */
export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SegmentedControlProps<TValue>) {
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
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          onFocus={() => onChange(option.value)}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
