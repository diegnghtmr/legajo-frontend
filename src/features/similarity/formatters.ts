/**
 * `computedNanos` (TRD §6.3) as an integer with the active language's
 * thousands separators (PRD HU-1.1: "tiempo de cómputo en nanosegundos").
 */
export function formatComputedNanos(nanos: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(nanos);
}

/**
 * `rawValue` (TRD §6.3) is `null` only in the documented degenerate cases
 * (TAC-05); this returns `null` straight through so the caller renders its
 * own explicit dash + accessible text instead of a formatted "null" string.
 * A non-null value is shown verbatim when it is an integer (e.g. Levenshtein
 * edit distance) and rounded to 4 decimals otherwise, so long floating-point
 * tails (cosine, distance) stay quiet and readable.
 */
export function formatRawValue(rawValue: number | null | undefined): string | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  return Number.isInteger(rawValue) ? String(rawValue) : rawValue.toFixed(4);
}

/**
 * Formats one trace field (TRD §6.3): the interface renders the backend's
 * own number verbatim, never recomputing it. An integer (a frequency, a
 * document count, a DP score) is shown with no decimal point; anything else
 * (a weight, a cosine, an angle, a distance) keeps 6 decimals, more than
 * `formatRawValue`'s 4 because a trace is read for audit, not skimmed in a
 * results table.
 */
export function formatTraceNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6);
}
