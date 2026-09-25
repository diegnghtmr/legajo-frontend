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

  it('keeps the label in the accessible tree, only visually hidden, when a compact caller asks for the dot alone', () => {
    render(<FamilyStatus family="classic" label="Classic" hideLabel />);

    // Still present for assistive technology — never a color-only channel —
    // just not painted, for a narrow row that only has room for the dot.
    const label = screen.getByText('Classic');
    expect(label).toBeInTheDocument();
    expect(label.className).toContain('sr-only');
  });
});
