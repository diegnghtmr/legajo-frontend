import { describe, expect, it } from 'vitest';

import {
  SHELL_HEADER_HEIGHT,
  SHELL_HEADER_HEIGHT_VAR,
  SHELL_MAIN_PADDING,
  SHELL_MAIN_PADDING_VAR,
  shellMetricsStyle,
} from './shellMetrics';

describe('shellMetrics', () => {
  it('sets both custom properties, keyed by their own exported var names', () => {
    expect(shellMetricsStyle).toEqual({
      [SHELL_HEADER_HEIGHT_VAR]: SHELL_HEADER_HEIGHT,
      [SHELL_MAIN_PADDING_VAR]: SHELL_MAIN_PADDING,
    });
  });

  it('names the header height and main padding vars distinctly', () => {
    expect(SHELL_HEADER_HEIGHT_VAR).not.toBe(SHELL_MAIN_PADDING_VAR);
    expect(SHELL_HEADER_HEIGHT_VAR.startsWith('--')).toBe(true);
    expect(SHELL_MAIN_PADDING_VAR.startsWith('--')).toBe(true);
  });
});
