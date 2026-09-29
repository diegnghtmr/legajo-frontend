/**
 * The current value of a motion duration token (`--dur-*`, declared on the
 * root in `index.css`) in milliseconds. The reduced-motion block zeroes every
 * token, so `0` means "do not animate" — which is also what a missing or
 * unparseable token (a test environment with no stylesheet) reads as.
 */
export function readMotionDurationMs(token: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const match = /^(\d+(?:\.\d+)?)ms$/.exec(raw);
  return match ? Number(match[1]) : 0;
}
