import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast.ts';

// The tokens themselves (src/index.css @theme), so a token value drifting
// away from its documented pairing fails this test instead of silently
// shipping an inaccessible combination.
const PAPER = '#fafafa';
const PAPER_RAISED = '#ffffff';
const INK_MUTED = '#737373';
const CLASSIC_SOFT = '#fef3c7';
const CLASSIC_FOREGROUND = '#78350f';
const AI_SOFT = '#ede9fe';
const AI_FOREGROUND = '#4c1d95';

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
