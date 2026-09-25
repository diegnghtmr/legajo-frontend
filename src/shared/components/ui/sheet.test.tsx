import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sheet, SheetContent } from './sheet';

describe('SheetContent', () => {
  it('docks full-height on the right edge by default (the trace/abstract sheet)', () => {
    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent title="Traza">Body</SheetContent>
      </Sheet>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('inset-y-0');
    expect(dialog.className).toContain('right-0');
    expect(dialog.className).toContain('h-full');
    expect(dialog.className).not.toContain('bottom-0');
  });

  it("docks to the bottom edge with a bounded height when side='bottom' (the corpus-list sheet)", () => {
    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent title="Corpus" side="bottom">
          Body
        </SheetContent>
      </Sheet>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('inset-x-0');
    expect(dialog.className).toContain('bottom-0');
    expect(dialog.className).toContain('max-h-[85dvh]');
    expect(dialog.className).not.toContain('right-0');
    expect(dialog.className).not.toContain('h-full');
  });

  it('gives the bottom sheet safe-area bottom padding, for a device inset', () => {
    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent title="Corpus" side="bottom">
          Body
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole('dialog').className).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('still exposes the required accessible title, visually hidden by default, for either side', () => {
    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent title="Corpus" side="bottom">
          Body
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole('dialog', { name: 'Corpus' })).toBeInTheDocument();
  });
});
