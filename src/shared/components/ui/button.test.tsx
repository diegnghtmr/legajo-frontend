import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('renders its children as a button', () => {
    render(<Button>Comparar</Button>);

    expect(screen.getByRole('button', { name: 'Comparar' })).toBeInTheDocument();
  });

  it('defaults to type="button" so it never submits a surrounding form by accident', () => {
    render(<Button>Comparar</Button>);

    expect(screen.getByRole('button', { name: 'Comparar' })).toHaveAttribute('type', 'button');
  });

  it('lets a caller opt into type="submit"', () => {
    render(<Button type="submit">Guardar</Button>);

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'submit');
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

  it('applies the quiet ghost variant: no fill at rest, paper-sunken and ink on hover', () => {
    render(<Button variant="ghost">Todos</Button>);

    const button = screen.getByRole('button', { name: 'Todos' });
    expect(button.className).toContain('text-ink-secondary');
    expect(button.className).toContain('hover:bg-paper-sunken');
    expect(button.className).toContain('hover:text-ink');
    expect(button.className).not.toContain('bg-primary');
    expect(button.className).not.toContain('border-hairline-strong');
  });

  it('keeps a 44px touch target on the ghost variant', () => {
    render(<Button variant="ghost">Todos</Button>);

    const button = screen.getByRole('button', { name: 'Todos' });
    expect(button.className).toContain('pointer-coarse:min-h-11');
    expect(button.className).toContain('pointer-coarse:min-w-11');
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

  it('only transitions colors and the press when the user has not requested reduced motion', () => {
    render(<Button>Comparar</Button>);

    const button = screen.getByRole('button', { name: 'Comparar' });
    expect(button.className).toContain('motion-safe:transition-[color,background-color');
    expect(button.className).not.toMatch(/(?<!motion-safe:)\btransition(-colors|-\[)/);
  });

  it('renders the mono algorithm-pick variant with no button chrome, unlike primary/secondary', () => {
    render(<Button variant="mono">levenshtein</Button>);

    const button = screen.getByRole('button', { name: 'levenshtein' });
    expect(button.className).toContain('font-mono');
    expect(button.className).toContain('border-transparent');
    expect(button.className).not.toContain('bg-primary');
    expect(button.className).not.toContain('bg-paper-raised');
  });

  it('widens the mono variant to a 44px tap target on coarse pointers via an invisible pseudo-element, not by resizing the visible text', () => {
    render(<Button variant="mono">levenshtein</Button>);

    const button = screen.getByRole('button', { name: 'levenshtein' });
    expect(button.className).toContain('relative');
    expect(button.className).toContain("pointer-coarse:before:content-['']");
    expect(button.className).toContain('pointer-coarse:before:inset-[-10px]');
  });

  it('lets a caller mark the mono variant active with an ink bottom border and ink text, overriding the inactive defaults', () => {
    render(
      <Button variant="mono" className="border-ink text-ink">
        embedding-local
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'embedding-local' });
    expect(button.className).toContain('border-ink');
    expect(button.className).toContain('text-ink');
    expect(button.className).not.toContain('border-transparent');
    expect(button.className).not.toContain('text-ink-secondary');
  });

  it.each(['primary', 'secondary', 'mono'] as const)(
    'scales the %s variant to the press token while pressed, only when motion is allowed',
    (variant) => {
      render(<Button variant={variant}>press</Button>);

      const button = screen.getByRole('button', { name: 'press' });
      expect(button.className).toContain('motion-safe:active:scale-(--press-scale)');
      // The scale is a transform: the button's layout box never changes.
      expect(button.className).toContain('motion-safe:transition-[');
      expect(button.className).toContain('transform');
      expect(button.className).toContain('active:duration-(--dur-instant)');
    },
  );

  it('never presses while disabled, since a disabled button takes no pointer events', () => {
    render(<Button disabled>press</Button>);

    expect(screen.getByRole('button', { name: 'press' }).className).toContain(
      'disabled:pointer-events-none',
    );
  });
});
