import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePanelOutOfView } from './usePanelOutOfView';

interface FakeEntry {
  isIntersecting: boolean;
  boundingClientRect: { top: number; bottom: number };
}

let callback: ((entries: FakeEntry[]) => void) | undefined;
let observedOptions: IntersectionObserverInit | undefined;
const disconnect = vi.fn();

beforeEach(() => {
  callback = undefined;
  observedOptions = undefined;
  disconnect.mockClear();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: FakeEntry[]) => void, options?: IntersectionObserverInit) {
        callback = cb;
        observedOptions = options;
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const outOfView = usePanelOutOfView(ref);
  return (
    <div>
      <div ref={ref}>panel</div>
      <output>{outOfView ? 'out' : 'in'}</output>
    </div>
  );
}

describe('usePanelOutOfView', () => {
  it('starts in view and observes with a top margin equal to the top bar height', () => {
    render(<Probe />);

    expect(screen.getByRole('status')).toHaveTextContent('in');
    expect(observedOptions?.rootMargin).toBe('-56px 0px 0px 0px');
  });

  it('reports out of view once the panel has scrolled up past the top bar', () => {
    render(<Probe />);

    act(() =>
      callback?.([{ isIntersecting: false, boundingClientRect: { top: -80, bottom: -10 } }]),
    );
    expect(screen.getByRole('status')).toHaveTextContent('out');

    act(() => callback?.([{ isIntersecting: true, boundingClientRect: { top: 60, bottom: 300 } }]));
    expect(screen.getByRole('status')).toHaveTextContent('in');
  });

  it('does not report out of view for a panel below the viewport', () => {
    render(<Probe />);

    act(() =>
      callback?.([{ isIntersecting: false, boundingClientRect: { top: 2000, bottom: 2200 } }]),
    );

    expect(screen.getByRole('status')).toHaveTextContent('in');
  });

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<Probe />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });

  it('stays in view when the browser has no IntersectionObserver', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('IntersectionObserver', undefined);

    render(<Probe />);

    expect(screen.getByRole('status')).toHaveTextContent('in');
  });
});
