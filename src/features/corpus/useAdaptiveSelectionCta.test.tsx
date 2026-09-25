import type { ReactNode } from 'react';
import { act, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSelectionStore } from './selectionStore';
import { useAdaptiveSelectionCta } from './useAdaptiveSelectionCta';

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/similarity']}>
      <LocationProbe />
      <Routes>
        <Route path="*" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

/**
 * The rail's own adaptive CTA logic (mode text, label, enabled state and the
 * navigation it triggers), extracted so both `SelectionRail` (the `lg`+
 * sidebar footer) and `SelectionTray` (the below-`lg` docked bar) drive the
 * exact same never-a-dead-end rule from one place — the two can never
 * silently disagree on when the CTA is enabled or where it navigates.
 */
describe('useAdaptiveSelectionCta', () => {
  it('is disabled with a reason below two selected', () => {
    const { result } = renderHook(() => useAdaptiveSelectionCta(), { wrapper });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.ctaEnabled).toBe(false);
    expect(result.current.ctaLabel).toBe('Comparar');
    expect(result.current.modeText).toBe('Selecciona al menos 2 para comparar.');
  });

  it('reads the sorted pairwise label and navigates to /similarity at exactly two selected', () => {
    useSelectionStore.setState({
      selectedIds: ['doc-02', 'doc-01'],
      canCompare: true,
      canMatrix: false,
    });
    const { result } = renderHook(() => useAdaptiveSelectionCta(), { wrapper });

    expect(result.current.ctaEnabled).toBe(true);
    // Sorted, never the raw toggle order.
    expect(result.current.ctaLabel).toBe('Comparar doc-01 y doc-02');
    expect(result.current.modeText).toBe('Comparación por pares');

    act(() => {
      result.current.onCtaClick();
    });

    expect(screen.getByTestId('location')).toHaveTextContent('/similarity');
  });

  it('reads the matrix label and navigates to /similarity/matrix at three or more selected', () => {
    useSelectionStore.setState({
      selectedIds: ['doc-01', 'doc-02', 'doc-03'],
      canCompare: true,
      canMatrix: true,
    });
    const { result } = renderHook(() => useAdaptiveSelectionCta(), { wrapper });

    expect(result.current.ctaEnabled).toBe(true);
    expect(result.current.ctaLabel).toBe('Ver matriz de 3');
    expect(result.current.modeText).toBe('Matriz de similitud');

    act(() => {
      result.current.onCtaClick();
    });

    expect(screen.getByTestId('location')).toHaveTextContent('/similarity/matrix');
  });
});
