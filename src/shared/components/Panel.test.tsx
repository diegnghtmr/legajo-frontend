import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Panel, PanelHeader } from './Panel';

describe('Panel', () => {
  it('renders its children inside a card region', () => {
    render(
      <Panel>
        <p>Trace content</p>
      </Panel>,
    );

    expect(screen.getByText('Trace content')).toBeInTheDocument();
  });
});

describe('PanelHeader', () => {
  it('renders the eyebrow, title and subtitle stack', () => {
    render(<PanelHeader eyebrow="Traza" title="Levenshtein" subtitle="Distancia de edición" />);

    expect(screen.getByText('Traza')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Levenshtein' })).toBeInTheDocument();
    expect(screen.getByText('Distancia de edición')).toBeInTheDocument();
  });

  it('omits the eyebrow and subtitle when not provided', () => {
    render(<PanelHeader title="Jaccard" />);

    expect(screen.getByRole('heading', { name: 'Jaccard' })).toBeInTheDocument();
    expect(screen.queryByText('Traza')).not.toBeInTheDocument();
  });
});
