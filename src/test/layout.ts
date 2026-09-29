import { vi } from 'vitest';

/**
 * jsdom has no layout engine: every element measures 0 wide. A test that
 * needs a real width makes every element report one, the way a browser
 * would at the moment a measuring ref attaches. Undo it with
 * `vi.restoreAllMocks()`.
 */
export function stubLaidOutWidth(width: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 100,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 100,
    toJSON: () => ({}),
  });
}
