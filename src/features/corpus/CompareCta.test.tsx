import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSelectionStore } from './selectionStore';
import { CompareCta } from './CompareCta';

beforeEach(() => {
  useSelectionStore.setState({ selectedIds: [], canCompare: false, canMatrix: false });
});

describe('CompareCta', () => {
  it('is disabled and shows the "select two" reason with 0 selected', () => {
    render(<CompareCta />);

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('Selecciona al menos dos artículos para comparar.'),
    ).toBeInTheDocument();
  });

  it('is disabled and shows the "select one more" reason with 1 selected', () => {
    useSelectionStore.getState().toggle('doc-01');

    render(<CompareCta />);

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Selecciona un artículo más para comparar.')).toBeInTheDocument();
  });

  it('is enabled with no reason text at exactly 2 selected', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');

    render(<CompareCta />);

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button).toBeEnabled();
    expect(
      screen.queryByText('Selecciona al menos dos artículos para comparar.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Selecciona un artículo más para comparar.')).not.toBeInTheDocument();
  });

  it('stays enabled above 2 selected', () => {
    useSelectionStore.getState().toggle('doc-01');
    useSelectionStore.getState().toggle('doc-02');
    useSelectionStore.getState().toggle('doc-03');

    render(<CompareCta />);

    expect(screen.getByRole('button', { name: 'Comparar' })).toBeEnabled();
  });
});
