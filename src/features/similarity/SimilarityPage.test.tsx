import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SimilarityPage } from './SimilarityPage';

describe('SimilarityPage', () => {
  it('renders the similarity section title', () => {
    render(<SimilarityPage />);

    expect(screen.getByRole('heading', { name: 'Comparación de similitud' })).toBeInTheDocument();
  });
});
