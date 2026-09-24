import type { AlgoFamily } from '../family';
import { cn } from '../lib/cn';

export interface ScoreBarProps {
  /** Similarity score already normalized to [0, 1] by the backend. */
  value: number;
  family: AlgoFamily;
  label: string;
}

/**
 * Mono score value + fill bar. The backend guarantees
 * `value` is within [0, 1]; this component renders it verbatim,
 * never clamps, and throws on a value outside that range. `role="meter"` fits a scalar measurement within a known
 * range better than `progressbar` (which implies task completion).
 */
export function ScoreBar({ value, family, label }: ScoreBarProps) {
  // A value outside the contract is a bug upstream; drawing it would show a misleading bar
  // (a negative width is dropped by the browser and renders full), so fail loudly instead.
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`ScoreBar value must be within [0, 1], got ${value}`);
  }
  const formatted = value.toFixed(3);
  const percentage = value * 100;

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-mono text-ink">{formatted}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={formatted}
        className="h-[6px] w-24 overflow-hidden rounded-full bg-paper-sunken"
      >
        <div
          className={cn('h-full rounded-full', family === 'classic' ? 'bg-classic' : 'bg-ai')}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
