import { create } from 'zustand';

/** Minimum selected articles to enable the pairwise "Compare" CTA. */
const MIN_FOR_COMPARE = 2;

/** Minimum selected articles to enable the m×m similarity matrix. */
const MIN_FOR_MATRIX = 3;

export interface SelectionState {
  selectedIds: readonly string[];
  /** True once at least `MIN_FOR_COMPARE` articles are selected. */
  canCompare: boolean;
  /** True once at least `MIN_FOR_MATRIX` articles are selected. */
  canMatrix: boolean;
  toggle: (id: string) => void;
  clear: () => void;
}

function deriveThresholds(
  selectedIds: readonly string[],
): Pick<SelectionState, 'canCompare' | 'canMatrix'> {
  return {
    canCompare: selectedIds.length >= MIN_FOR_COMPARE,
    canMatrix: selectedIds.length >= MIN_FOR_MATRIX,
  };
}

/**
 * Deterministic pair order for exactly two selected ids — sorted, never the
 * raw toggle/click order the store itself keeps (`selectedIds` is an
 * insertion-ordered array, so selecting d02 before d01 would otherwise flip
 * which document is "A" and which is "B"). Every caller that renders or acts
 * on a pair (the rail's CTA label, the compare screen's own derivation) uses
 * this same helper, so they can never disagree with each other.
 */
export function sortedPair(ids: readonly string[]): readonly [string, string] {
  const [a, b] = [...ids].sort();
  return [a, b];
}

/**
 * Article multi-select for corpus/similarity ("simple toggles
 * stay in Zustand, not react-hook-form"). `canCompare`/`canMatrix` are
 * recomputed on every mutation rather than derived at read time, so callers
 * can select them directly without a memoized selector.
 */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: [],
  canCompare: false,
  canMatrix: false,
  toggle: (id) =>
    set((state) => {
      const selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((existing) => existing !== id)
        : [...state.selectedIds, id];

      return { selectedIds, ...deriveThresholds(selectedIds) };
    }),
  clear: () => set({ selectedIds: [], ...deriveThresholds([]) }),
}));
