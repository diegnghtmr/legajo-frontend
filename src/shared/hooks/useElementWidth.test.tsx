import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useElementWidth } from './useElementWidth';

/**
 * A controllable fake, installed per test via `vi.stubGlobal` (the pattern
 * `src/test/setup.ts` documents): jsdom's own default `ResizeObserver` stub
 * never fires a callback, so a test that needs one installs this instead.
 */
class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}

  trigger(width: number): void {
    this.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

function Measured({ initial }: { initial: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(initial);
  return <div ref={ref} data-testid="measured" data-width={width} />;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeResizeObserver.instances = [];
});

describe('useElementWidth', () => {
  it('starts at the given initial width before any observation ever fires', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { getByTestId } = render(<Measured initial={640} />);

    expect(getByTestId('measured').dataset.width).toBe('640');
  });

  it('updates to the observed content width once the observer reports one', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { getByTestId } = render(<Measured initial={640} />);
    act(() => {
      FakeResizeObserver.instances[0]?.trigger(912);
    });

    expect(getByTestId('measured').dataset.width).toBe('912');
  });

  it('disconnects its observer on unmount', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const disconnectSpy = vi.spyOn(FakeResizeObserver.prototype, 'disconnect');

    const { unmount } = render(<Measured initial={640} />);
    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('stays at the initial width under the default no-op ResizeObserver stub (no fake installed)', () => {
    const { getByTestId } = render(<Measured initial={480} />);

    expect(getByTestId('measured').dataset.width).toBe('480');
  });
});
