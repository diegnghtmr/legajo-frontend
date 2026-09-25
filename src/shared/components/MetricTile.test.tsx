import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricTile } from './MetricTile';

describe('MetricTile', () => {
  it('renders the eyebrow key, the label and the mono value', () => {
    render(<MetricTile eyebrow="Cophenetic" label="single" value="0.842" />);

    expect(screen.getByText('Cophenetic')).toBeInTheDocument();
    expect(screen.getByText('single')).toBeInTheDocument();
    expect(screen.getByText('0.842')).toBeInTheDocument();
  });

  it('does not render a leader marker when leader is not flagged', () => {
    render(<MetricTile eyebrow="Cophenetic" label="single" value="0.842" />);

    expect(screen.queryByText(/leader/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tree/i)).not.toBeInTheDocument();
  });

  it('renders the leader marker only when leader is flagged', () => {
    render(
      <MetricTile eyebrow="Silhouette" label="ward" value="0.611" leader leaderLabel="Tree" />,
    );

    expect(screen.getByText('Tree')).toBeInTheDocument();
  });

  it('renders the leader marker as an ink-bordered badge, not the soft-pill default', () => {
    render(
      <MetricTile eyebrow="Silhouette" label="ward" value="0.611" leader leaderLabel="Tree" />,
    );

    const marker = screen.getByText('Tree');
    expect(marker.className).toContain('border-ink');
    expect(marker.className).toContain('rounded-sm');
    expect(marker.className).not.toContain('border-hairline-strong');
    expect(marker.className).not.toContain('rounded-full');
  });
});
