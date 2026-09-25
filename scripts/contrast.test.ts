import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast.ts';

/**
 * `src/index.css`'s absolute path, resolved from this test file's own
 * directory (`import.meta.dirname`) rather than `process.cwd()` — the
 * runner's working directory is whatever invoked it, not necessarily the
 * repo root, so a `process.cwd()`-based path is only an accident of how the
 * command happens to be run today.
 */
const INDEX_CSS_PATH = join(import.meta.dirname, '..', 'src', 'index.css');

/**
 * Reads a token's actual hex value from `src/index.css`'s `@theme` block
 * instead of a hardcoded copy in this file: a copy would keep passing even
 * after the real token drifted away from its documented pairing, proving
 * nothing about the tokens the app actually ships.
 */
function readColorToken(name: string): string {
  const css = readFileSync(INDEX_CSS_PATH, 'utf8');
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(css);
  if (!match) {
    throw new Error(`Token --color-${name} not found in src/index.css`);
  }
  return match[1]!;
}

const PAPER = readColorToken('paper');
const PAPER_RAISED = readColorToken('paper-raised');
const INK_MUTED = readColorToken('ink-muted');
const CLASSIC_SOFT = readColorToken('classic-soft');
const CLASSIC_FOREGROUND = readColorToken('classic-foreground');
const AI_SOFT = readColorToken('ai-soft');
const AI_FOREGROUND = readColorToken('ai-foreground');

describe('readColorToken (resolving src/index.css)', () => {
  it('resolves src/index.css relative to this test file, not the process working directory', () => {
    // A path built from process.cwd() only works when the runner happens to
    // be invoked from the repo root; readColorToken must keep finding
    // src/index.css even when the current process directory points
    // somewhere else entirely.
    const originalCwd = process.cwd();
    process.chdir('/tmp');
    try {
      expect(readColorToken('paper')).toBe('#fafafa');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('contrastRatio', () => {
  it('computes the WCAG contrast ratio between two colors (black on white is 21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('is symmetric: the argument order does not change the ratio', () => {
    expect(contrastRatio('#171717', '#fafafa')).toBeCloseTo(contrastRatio('#fafafa', '#171717'));
  });
});

describe('AA contrast (>= 4.5:1) for primitive text/surface pairs', () => {
  it('CardDescription: ink-muted text on the paper-raised card surface', () => {
    expect(contrastRatio(INK_MUTED, PAPER_RAISED)).toBeGreaterThanOrEqual(4.5);
  });

  it('ink-muted text on the plain paper page background', () => {
    expect(contrastRatio(INK_MUTED, PAPER)).toBeGreaterThanOrEqual(4.5);
  });

  it('Badge classic variant: classic-foreground text on classic-soft', () => {
    expect(contrastRatio(CLASSIC_FOREGROUND, CLASSIC_SOFT)).toBeGreaterThanOrEqual(4.5);
  });

  it('Badge ai variant: ai-foreground text on ai-soft', () => {
    expect(contrastRatio(AI_FOREGROUND, AI_SOFT)).toBeGreaterThanOrEqual(4.5);
  });
});
