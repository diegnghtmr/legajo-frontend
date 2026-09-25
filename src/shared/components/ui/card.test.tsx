import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

describe('Card', () => {
  it('renders a title, description and content as a composed card', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Corpus</CardTitle>
          <CardDescription>20 abstracts</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
    );

    expect(screen.getByText('Corpus')).toBeInTheDocument();
    expect(screen.getByText('20 abstracts')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies the paper-raised hairline surface to the card root', () => {
    render(<Card data-testid="card">Body</Card>);

    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-paper-raised');
    expect(card.className).toContain('border-hairline');
  });

  it('merges a caller className onto the card root', () => {
    render(
      <Card data-testid="card" className="p-8">
        Body
      </Card>,
    );

    expect(screen.getByTestId('card').className).toContain('p-8');
  });
});
