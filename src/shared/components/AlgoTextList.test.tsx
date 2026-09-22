import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AlgoTextList } from './AlgoTextList';

const OPTIONS = [
  { id: 'levenshtein', family: 'classic' as const },
  { id: 'needleman-wunsch', family: 'classic' as const },
  { id: 'embedding-local', family: 'ai' as const },
];

describe('AlgoTextList', () => {
  it('renders one toggle button per option, marking selected ids as pressed', () => {
    render(
      <AlgoTextList
        options={OPTIONS}
        selectedIds={['levenshtein']}
        onToggle={vi.fn()}
        aria-label="Algorithms"
      />,
    );

    expect(screen.getByRole('group', { name: 'Algorithms' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /levenshtein/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /needleman-wunsch/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /embedding-local/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onToggle with the clicked option id', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <AlgoTextList
        options={OPTIONS}
        selectedIds={[]}
        onToggle={onToggle}
        aria-label="Algorithms"
      />,
    );

    await user.click(screen.getByRole('button', { name: /embedding-local/i }));

    expect(onToggle).toHaveBeenCalledWith('embedding-local');
  });
});
