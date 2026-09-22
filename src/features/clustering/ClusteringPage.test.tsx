import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClusteringPage } from './ClusteringPage';

describe('ClusteringPage', () => {
  it('renders the clustering section title', () => {
    render(<ClusteringPage />);

    expect(screen.getByRole('heading', { name: 'Agrupamiento jerárquico' })).toBeInTheDocument();
  });
});
