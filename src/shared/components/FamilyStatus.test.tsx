import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FamilyStatus } from './FamilyStatus';

describe('FamilyStatus', () => {
  it('renders a visible text label for the classic family, not only a color dot', () => {
    render(<FamilyStatus family="classic" label="Classic" />);

    expect(screen.getByText('Classic')).toBeInTheDocument();
  });

  it('renders a visible text label for the AI family', () => {
    render(<FamilyStatus family="ai" label="AI" />);

    expect(screen.getByText('AI')).toBeInTheDocument();
  });
});
