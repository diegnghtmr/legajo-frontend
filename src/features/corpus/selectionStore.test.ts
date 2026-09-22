import { beforeEach, describe, expect, it } from 'vitest';

import { useSelectionStore } from './selectionStore';

/** Resets the shared Zustand store between tests (module-level singleton). */
beforeEach(() => {
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

describe('useSelectionStore', () => {
  it('starts with no selection and both thresholds unmet', () => {
    const state = useSelectionStore.getState();

    expect(state.selectedIds).toEqual([]);
    expect(state.canCompare).toBe(false);
    expect(state.canMatrix).toBe(false);
  });

  it('toggle adds an id that is not selected yet', () => {
    useSelectionStore.getState().toggle('doc-01');

    expect(useSelectionStore.getState().selectedIds).toEqual(['doc-01']);
  });

  it('toggle removes an id that is already selected', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-01');

    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('toggle preserves other selected ids', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    useSelectionStore.getState().toggle('doc-01');

    expect(useSelectionStore.getState().selectedIds).toEqual(['doc-02']);
  });

  it('clear empties the selection', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');

    useSelectionStore.getState().clear();

    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('canCompare is false with 0 or 1 selected and true at exactly 2', () => {
    expect(useSelectionStore.getState().canCompare).toBe(false);

    useSelectionStore.getState().toggle('doc-01');
    expect(useSelectionStore.getState().canCompare).toBe(false);

    useSelectionStore.getState().toggle('doc-02');
    expect(useSelectionStore.getState().canCompare).toBe(true);
  });

  it('canMatrix is false below 3 selected and true at exactly 3', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    expect(useSelectionStore.getState().canMatrix).toBe(false);

    useSelectionStore.getState().toggle('doc-03');
    expect(useSelectionStore.getState().canMatrix).toBe(true);
  });

  it('clear resets canCompare and canMatrix back to false', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    useSelectionStore.getState().toggle('doc-03');

    useSelectionStore.getState().clear();

    expect(useSelectionStore.getState().canCompare).toBe(false);
    expect(useSelectionStore.getState().canMatrix).toBe(false);
  });
});
