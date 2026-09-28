import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { stubLaidOutWidth } from '../../test/layout';
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

function Measured({ padding }: { padding?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-testid="measured"
      data-width={width ?? 'unknown'}
      style={padding === undefined ? undefined : { padding: `0 ${padding}px` }}
    />
  );
}

/** Renders its measured element only once `show` is true — the shape of a
 * conditional/loading render that mounts its measured node later than the
 * component's own first render. */
function DelayedMeasured({ show }: { show: boolean }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return show ? <div ref={ref} data-testid="measured" data-width={width ?? 'unknown'} /> : null;
}

/** Moves the same hook's ref from one host node to a different one (forced
 * via `key`, so React actually unmounts the old node and mounts a new one
 * instead of reusing it) — the shape of a ref that gets handed to a
 * different underlying element across renders. */
function SwitchableMeasured({ useSecond }: { useSecond: boolean }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return useSecond ? (
    <div key="second" ref={ref} data-testid="second" data-width={width ?? 'unknown'} />
  ) : (
    <div key="first" ref={ref} data-testid="first" data-width={width ?? 'unknown'} />
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
  it('reports the laid-out width as soon as the element attaches, with no observer callback', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stubLaidOutWidth(500);

    const { getByTestId } = render(<Measured />);

    expect(getByTestId('measured').dataset.width).toBe('500');
  });

  it('reads the content width, without the element padding', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stubLaidOutWidth(500);

    const { getByTestId } = render(<Measured padding={10} />);

    expect(getByTestId('measured').dataset.width).toBe('480');
  });

  it('has no width while the element has no layout, instead of guessing one', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { getByTestId } = render(<Measured />);

    expect(getByTestId('measured').dataset.width).toBe('unknown');
  });

  it('follows the observed content width once the observer reports a change', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stubLaidOutWidth(500);

    const { getByTestId } = render(<Measured />);
    act(() => {
      FakeResizeObserver.instances[0]?.trigger(912);
    });

    expect(getByTestId('measured').dataset.width).toBe('912');
  });

  it('takes the first observed width when the element had no layout on attach', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { getByTestId } = render(<Measured />);
    act(() => {
      FakeResizeObserver.instances[0]?.trigger(640);
    });

    expect(getByTestId('measured').dataset.width).toBe('640');
  });

  it('disconnects its observer on unmount', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const disconnectSpy = vi.spyOn(FakeResizeObserver.prototype, 'disconnect');

    const { unmount } = render(<Measured />);
    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('observes an element that only attaches on a later render, not just whatever is mounted at the first render', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stubLaidOutWidth(300);

    const { rerender, queryByTestId } = render(<DelayedMeasured show={false} />);
    expect(queryByTestId('measured')).not.toBeInTheDocument();
    expect(FakeResizeObserver.instances).toHaveLength(0);

    rerender(<DelayedMeasured show={true} />);
    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(queryByTestId('measured')?.getAttribute('data-width')).toBe('300');

    act(() => {
      FakeResizeObserver.instances[0]?.trigger(777);
    });

    expect(queryByTestId('measured')?.getAttribute('data-width')).toBe('777');
  });

  it('disconnects the old observer and observes the new node when the ref moves to a different element', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const disconnectSpy = vi.spyOn(FakeResizeObserver.prototype, 'disconnect');

    const { rerender, getByTestId } = render(<SwitchableMeasured useSecond={false} />);
    expect(FakeResizeObserver.instances).toHaveLength(1);

    rerender(<SwitchableMeasured useSecond={true} />);

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(FakeResizeObserver.instances).toHaveLength(2);

    act(() => {
      FakeResizeObserver.instances[1]?.trigger(999);
    });

    expect(getByTestId('second').dataset.width).toBe('999');
  });
});
