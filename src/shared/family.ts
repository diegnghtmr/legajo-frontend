/**
 * The two algorithm families the backend classifies every capability into.
 * Never translated, never a third value — family switching is locked
 * to exactly these two plus an "all" filter elsewhere.
 */
export const ALGO_FAMILY = {
  CLASSIC: 'classic',
  AI: 'ai',
} as const;

export type AlgoFamily = (typeof ALGO_FAMILY)[keyof typeof ALGO_FAMILY];
