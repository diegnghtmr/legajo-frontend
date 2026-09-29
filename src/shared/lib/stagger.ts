import type { CSSProperties } from 'react';

/** Rows past this index enter together, so a long list never waits on its tail. */
export const MAX_STAGGER_INDEX = 12;

/** The `--i` the `enter-*` utilities read to delay an element by its place in a list. */
export function staggerStyle(index: number): CSSProperties {
  return { '--i': Math.min(index, MAX_STAGGER_INDEX) } as CSSProperties;
}
