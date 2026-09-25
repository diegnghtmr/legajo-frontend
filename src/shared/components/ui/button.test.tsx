import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('renders its children as a button', () => {
    render(<Button>Comparar</Button>);

    expect(screen.getByRole('button', { name: 'Comparar' })).toBeInTheDocument();
  });

  it('applies the ink-fill primary variant by default', () => {
    render(<Button>Primary</Button>);

    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('text-primary-foreground');
  });

  it('applies the paper-fill secondary variant when requested', () => {
    render(<Button variant="secondary">Secondary</Button>);

    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button.className).toContain('bg-paper-raised');
    expect(button.className).toContain('border');
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);

    await user.click(screen.getByRole('button', { name: 'Click' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Disabled' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('merges a caller className with its own, letting the caller override', () => {
    render(<Button className="px-10">Wide</Button>);

    const button = screen.getByRole('button', { name: 'Wide' });
    expect(button.className).toContain('px-10');
    expect(button.className).not.toMatch(/\bpx-4\b/);
  });

  it('grows to a 44px touch target on coarse pointers without resizing on desktop', () => {
    render(<Button>Comparar</Button>);

    const button = screen.getByRole('button', { name: 'Comparar' });
    // h-9 (36px) stays the base size for a mouse; pointer-coarse:min-h-11
    // (44px) only takes effect under `@media (pointer: coarse)`, so desktop
    // density is untouched.
    expect(button.className).toContain('h-9');
    expect(button.className).toContain('pointer-coarse:min-h-11');
    expect(button.className).toContain('pointer-coarse:min-w-11');
  });

  it('shows a visible focus ring only on keyboard focus, in the ink/focus token', () => {
    render(<Button>Comparar</Button>);

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button.className).toContain('focus-visible:outline');
    expect(button.className).toContain('focus-visible:outline-ring');
  });

  it('marks the disabled state to assistive tech via the native disabled attribute', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:opacity-45');
  });

  it('only transitions colors when the user has not requested reduced motion', () => {
    render(<Button>Comparar</Button>);

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button.className).toContain('motion-safe:transition-colors');
    expect(button.className).not.toMatch(/(?<!motion-safe:)\btransition-colors\b/);
  });
});
