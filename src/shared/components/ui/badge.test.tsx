import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>cached</Badge>);

    expect(screen.getByText('cached')).toBeInTheDocument();
  });

  it('uses the classic family color for the classic variant, never as page chrome', () => {
    render(<Badge variant="classic">Classic</Badge>);

    expect(screen.getByText('Classic').className).toContain('classic');
  });

  it('uses the ai family color for the ai variant', () => {
    render(<Badge variant="ai">AI</Badge>);

    expect(screen.getByText('AI').className).toContain('ai');
  });
});
