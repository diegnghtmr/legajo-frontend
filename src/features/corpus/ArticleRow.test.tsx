import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ArticleRow } from './ArticleRow';

const summary = { id: 'doc-01', title: 'A study of similarity', authors: ['A. One', 'B. Two'] };

function renderRow(overrides: Partial<React.ComponentProps<typeof ArticleRow>> = {}) {
  const onToggle = vi.fn();
  render(
    <MemoryRouter>
      <ArticleRow {...summary} selected={false} onToggle={onToggle} {...overrides} />
    </MemoryRouter>,
  );
  return { onToggle };
}

describe('ArticleRow', () => {
  it('renders the title as a link to the article detail route', () => {
    renderRow();

    const link = screen.getByRole('link', { name: summary.title });
    expect(link).toHaveAttribute('href', '/corpus/doc-01');
  });

  it('renders the mono id and the authors on their own stacked lines, never joined by ·', () => {
    renderRow();

    expect(screen.getByText('doc-01')).toBeInTheDocument();
    expect(screen.getByText('A. One, B. Two')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('exposes selection as an accessible checkbox reflecting the selected prop', () => {
    renderRow({ selected: true });

    const checkbox = screen.getByRole('checkbox', { name: summary.title });
    expect(checkbox).toBeChecked();
  });

  it('an unselected row renders an unchecked checkbox', () => {
    renderRow({ selected: false });

    expect(screen.getByRole('checkbox', { name: summary.title })).not.toBeChecked();
  });

  it('calls onToggle with the article id on click', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderRow();

    await user.click(screen.getByRole('checkbox', { name: summary.title }));

    expect(onToggle).toHaveBeenCalledWith('doc-01');
  });

  it('calls onToggle with the article id on keyboard activation (space)', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderRow();

    await user.tab();
    await user.keyboard(' ');

    expect(onToggle).toHaveBeenCalledWith('doc-01');
  });
});
