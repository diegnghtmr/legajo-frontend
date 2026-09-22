import { create } from 'zustand';

/** Minimum selected articles to enable the pairwise "Compare" CTA (PRD HU-1.1). */
const MIN_FOR_COMPARE = 2;

/** Minimum selected articles to enable the m×m similarity matrix (PRD HU-1.4). */
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
 * Article multi-select for corpus/similarity (DESIGN.md §7.3: "simple toggles
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
