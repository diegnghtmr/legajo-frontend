import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders a decorative block hidden from assistive tech', () => {
    const { container } = render(<Skeleton />);

    const block = container.querySelector('[data-slot="skeleton"]');
    expect(block).not.toBeNull();
    expect(block).toHaveAttribute('aria-hidden', 'true');
  });

  it('fills with the hairline token and the sm radius, on the tokens the app already uses', () => {
    const { container } = render(<Skeleton />);

    const block = container.querySelector('[data-slot="skeleton"]');
    expect(block?.className).toContain('bg-hairline');
    expect(block?.className).toContain('rounded-sm');
  });

  it('shimmers through the gated sheen utility, never a bare or pulsing animation', () => {
    const { container } = render(<Skeleton />);

    const block = container.querySelector('[data-slot="skeleton"]');
    expect(block?.className).toContain('skeleton-sheen');
    expect(block?.className).not.toContain('animate-pulse');
    expect(block?.className).not.toMatch(/(?<!skeleton-)\bsheen\b|\banimate-/);
  });

  it('merges a caller className with its own, letting the caller override sizing', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);

    const block = container.querySelector('[data-slot="skeleton"]');
    expect(block?.className).toContain('h-4');
    expect(block?.className).toContain('w-24');
  });

  it('forwards other div props, such as a test id', () => {
    const { container } = render(<Skeleton data-testid="row-title-skeleton" />);

    expect(container.querySelector('[data-testid="row-title-skeleton"]')).not.toBeNull();
  });
});
