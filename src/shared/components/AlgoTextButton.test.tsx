import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AlgoTextButton } from './AlgoTextButton';

describe('AlgoTextButton', () => {
  it('renders the mono algorithm id and reflects the active state via aria-pressed', () => {
    render(<AlgoTextButton id="levenshtein" family="classic" active={false} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: /levenshtein/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles aria-pressed to true when active', () => {
    render(<AlgoTextButton id="embedding-local" family="ai" active onToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: /embedding-local/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<AlgoTextButton id="jaccard" family="classic" active={false} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: /jaccard/i }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('marks family with a visible, non-color-only glyph and matching sr-only text', () => {
    render(<AlgoTextButton id="cosine-tfidf" family="classic" active={false} onToggle={vi.fn()} />);

    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText(/classic algorithm/i)).toBeInTheDocument();
  });

  it('uses a different visible family glyph for the AI family', () => {
    render(<AlgoTextButton id="embedding-api" family="ai" active={false} onToggle={vi.fn()} />);

    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText(/ai algorithm/i)).toBeInTheDocument();
  });
});
