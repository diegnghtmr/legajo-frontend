import type { CSSProperties, ReactNode } from 'react';

import { Minus, Plus } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

export interface NumberStepperProps {
  id: string;
  /** Visible label; it names the field for assistive technology. */
  label: ReactNode;
  /** The current value; `NaN` stands for an empty field. */
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  /** Shown as `danger` text (`role="alert"`) only while the value is invalid. */
  error: string;
  /** Shown under the field while the value is valid. */
  hint?: ReactNode;
  /** A range slider beside the field that mirrors it; `aria-hidden` and
   * unfocusable, because the field itself is the accessible control. */
  slider?: boolean;
  /** An action on the field's own row, after the stepper (and slider). */
  trailing?: ReactNode;
  className?: string;
}

const STEP_BUTTON_CLASS_NAME =
  'flex w-8 items-center justify-center text-ink-secondary hover:bg-paper-sunken hover:text-ink motion-safe:transition-colors motion-safe:duration-(--dur-fast) focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-35 pointer-coarse:min-h-11 pointer-coarse:min-w-11';

/** Whether `value` is a whole number inside `[min, max]`. */
function isValidStep(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * An integer field with minus and plus buttons, bounded to `[min, max]`. The
 * buttons disable at the bounds; from an empty field, plus jumps to the
 * minimum. The value is invalid when it is empty, fractional or out of range:
 * the input is then `aria-invalid` and the error appears under it as
 * `role="alert"`; otherwise the hint (if any) shows.
 */
export function NumberStepper({
  id,
  label,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  error,
  hint,
  slider = false,
  trailing,
  className,
}: NumberStepperProps) {
  const isEmpty = Number.isNaN(value);
  const isValid = isValidStep(value, min, max);
  const messageId = `${id}-message`;
  const sliderValue = isValid
    ? value
    : Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min));
  const fill = max > min ? ((sliderValue - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label text-ink-secondary">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-9 items-stretch overflow-hidden rounded-btn border border-hairline-strong bg-paper-raised pointer-coarse:h-auto">
          <button
            type="button"
            aria-label={decreaseLabel}
            disabled={isEmpty || value <= min}
            onClick={() => onChange(value - 1)}
            className={STEP_BUTTON_CLASS_NAME}
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={isEmpty ? '' : value}
            aria-invalid={!isValid}
            aria-describedby={!isValid ? messageId : undefined}
            onChange={(event) => onChange(event.target.valueAsNumber)}
            className="w-11 min-w-11 border-x border-hairline bg-transparent text-center font-mono text-[13px] text-ink [appearance:textfield] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label={increaseLabel}
            disabled={!isEmpty && value >= max}
            onClick={() => onChange(isEmpty ? min : value + 1)}
            className={STEP_BUTTON_CLASS_NAME}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        {slider && (
          <input
            type="range"
            aria-hidden="true"
            tabIndex={-1}
            min={min}
            max={max}
            step={1}
            value={sliderValue}
            onChange={(event) => onChange(event.target.valueAsNumber)}
            style={{ '--fill': `${fill}%` } as CSSProperties}
            className="stepper-range w-[140px]"
          />
        )}
        {trailing}
      </div>
      {isValid ? (
        hint !== undefined && <p className="w-0 min-w-full text-label text-ink-muted">{hint}</p>
      ) : (
        <p id={messageId} role="alert" className="w-0 min-w-full text-label text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
