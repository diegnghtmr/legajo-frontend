import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { focusableInSkeletons } from './skeletonFocus';

describe('focusableInSkeletons', () => {
  it('flags a control a keyboard can reach inside an aria-hidden subtree', () => {
    const { container } = render(
      <div aria-hidden="true">
        <button type="button">reachable</button>
      </div>,
    );
    expect(focusableInSkeletons(container)).toHaveLength(1);
  });

  it('accepts a pointer-only control that is not a tab stop (tabindex -1)', () => {
    const { container } = render(
      <div aria-hidden="true">
        <button type="button" tabIndex={-1}>
          pointer only
        </button>
      </div>,
    );
    expect(focusableInSkeletons(container)).toEqual([]);
  });
});
