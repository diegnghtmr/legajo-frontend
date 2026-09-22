/**
 * The two algorithm families the backend classifies every capability into
 * (TRD §6.6). Never translated, never a third value — DESIGN.md §7.1 locks
 * family switching to exactly these two plus an "all" filter elsewhere.
 */
export const ALGO_FAMILY = {
  CLASSIC: 'classic',
  AI: 'ai',
} as const;

export type AlgoFamily = (typeof ALGO_FAMILY)[keyof typeof ALGO_FAMILY];
