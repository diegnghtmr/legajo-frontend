/** `totalRamBytes` (TRD §6.6) formatted as binary gigabytes, one decimal. */
export function formatRamBytes(totalRamBytes: number): string {
  const gb = totalRamBytes / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}

/**
 * Drops the sub-second fraction from the harness's ISO-8601 `measuredAt`
 * instant, for a stable mono display. Falls back to the raw string when it
 * cannot be parsed, rather than showing "Invalid Date".
 */
export function formatMeasuredAt(measuredAt: string): string {
  const date = new Date(measuredAt);
  if (Number.isNaN(date.getTime())) {
    return measuredAt;
  }
  return `${date.toISOString().split('.')[0]}Z`;
}
