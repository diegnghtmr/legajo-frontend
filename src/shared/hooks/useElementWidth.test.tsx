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

/** Renders its measured element only once `show` is true — the shape of a
 * conditional/loading render that mounts its measured node later than the
 * component's own first render. */
function DelayedMeasured({ show, initial }: { show: boolean; initial: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(initial);
  return show ? <div ref={ref} data-testid="measured" data-width={width} /> : null;
}

/** Moves the same hook's ref from one host node to a different one (forced
 * via `key`, so React actually unmounts the old node and mounts a new one
 * instead of reusing it) — the shape of a ref that gets handed to a
 * different underlying element across renders. */
function SwitchableMeasured({ useSecond, initial }: { useSecond: boolean; initial: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(initial);
  return useSecond ? (
    <div key="second" ref={ref} data-testid="second" data-width={width} />
  ) : (
    <div key="first" ref={ref} data-testid="first" data-width={width} />
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  // Restores every `vi.spyOn` from this file's own tests (e.g. the
  // `disconnect` spy below) — without this, an un-restored spy on
  // `FakeResizeObserver.prototype.disconnect` from an earlier test keeps
  // accumulating call counts a later test's own spy would otherwise
  // wrongly inherit.
  vi.restoreAllMocks();
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

  it('observes an element that only attaches on a later render, not just whatever is mounted at the first render', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { rerender, queryByTestId } = render(<DelayedMeasured show={false} initial={500} />);
    expect(queryByTestId('measured')).not.toBeInTheDocument();
    expect(FakeResizeObserver.instances).toHaveLength(0);

    rerender(<DelayedMeasured show={true} initial={500} />);
    expect(FakeResizeObserver.instances).toHaveLength(1);

    act(() => {
      FakeResizeObserver.instances[0]?.trigger(777);
    });

    expect(queryByTestId('measured')?.getAttribute('data-width')).toBe('777');
  });

  it('disconnects the old observer and observes the new node when the ref moves to a different element', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const disconnectSpy = vi.spyOn(FakeResizeObserver.prototype, 'disconnect');

    const { rerender, getByTestId } = render(
      <SwitchableMeasured useSecond={false} initial={320} />,
    );
    expect(FakeResizeObserver.instances).toHaveLength(1);

    rerender(<SwitchableMeasured useSecond={true} initial={320} />);

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(FakeResizeObserver.instances).toHaveLength(2);

    act(() => {
      FakeResizeObserver.instances[1]?.trigger(999);
    });

    expect(getByTestId('second').dataset.width).toBe('999');
  });
});
