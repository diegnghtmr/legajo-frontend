import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AlgoTextButton } from './AlgoTextButton';

describe('AlgoTextButton', () => {
  it('renders the mono algorithm id and reflects the active state via aria-pressed', () => {
    render(<AlgoTextButton id="levenshtein" active={false} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: /levenshtein/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles aria-pressed to true when active', () => {
    render(<AlgoTextButton id="embedding-local" active onToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: /embedding-local/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<AlgoTextButton id="jaccard" active={false} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: /jaccard/i }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows only the mono algorithm id, with no family marker', () => {
    render(<AlgoTextButton id="tfidf-cosine" active={false} onToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'tfidf-cosine' })).toHaveTextContent(
      /^tfidf-cosine$/,
    );
  });

  it('draws no tick box unless asked to', () => {
    render(<AlgoTextButton id="jaccard" active={false} onToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'jaccard' }).querySelector('[data-tick]')).toBeNull();
  });

  it('draws an aria-hidden tick box that fills when active, leaving the accessible name intact', () => {
    const { rerender } = render(
      <AlgoTextButton id="ward" active={false} tick onToggle={vi.fn()} />,
    );

    const button = screen.getByRole('button', { name: 'ward' });
    const tick = button.querySelector('[data-tick]');
    expect(tick).not.toBeNull();
    expect(tick).toHaveAttribute('aria-hidden', 'true');
    expect(tick?.querySelector('svg')).toBeNull();

    rerender(<AlgoTextButton id="ward" active tick onToggle={vi.fn()} />);

    expect(button.querySelector('[data-tick]')?.querySelector('svg')).not.toBeNull();
    expect(button.querySelector('[data-tick]')).toHaveClass('bg-ink');
  });
});
