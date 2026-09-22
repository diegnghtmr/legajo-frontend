import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('renders the not-found title', () => {
    render(<NotFoundPage />);

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });
});
