import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'index.css'), 'utf8');

/** Body of the first top-level block that starts with `header` (brace-balanced). */
function blockBody(css: string, header: string): string {
  const start = css.indexOf(header);
  if (start === -1) throw new Error(`Block "${header}" not found in src/index.css`);
  const open = css.indexOf('{', start);
  let depth = 1;
  let index = open + 1;
  while (index < css.length && depth > 0) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') depth -= 1;
    index += 1;
  }
  return css.slice(open + 1, index - 1);
}

const THEME = blockBody(CSS, '@theme {');

describe('color tokens', () => {
  it.each([
    ['cluster-1', '#0f766e'],
    ['cluster-2', '#4338ca'],
    ['cluster-3', '#be185d'],
    ['cluster-4', '#4d7c0f'],
    ['cluster-5', '#b45309'],
    ['cluster-6', '#0369a1'],
    ['cluster-7', '#7e22ce'],
    ['cluster-8', '#475569'],
    ['success-soft', '#dcfce7'],
    ['warning-soft', '#fef9c3'],
    ['danger-soft', '#fee2e2'],
    ['skeleton-sheen', '#f0f0f0'],
  ])('declares --color-%s as %s inside @theme', (name, hex) => {
    expect(THEME).toMatch(new RegExp(`--color-${name}:\\s*${hex}\\s*;`));
  });

  it.each([
    ['chart-line', 'ink'],
    ['chart-theoretical', 'ink-muted'],
    ['chart-grid', 'hairline'],
    ['chart-cut', 'warning'],
    ['skeleton-base', 'hairline'],
  ])('aliases --color-%s to --color-%s without a new hex', (name, target) => {
    expect(THEME).toMatch(new RegExp(`--color-${name}:\\s*var\\(--color-${target}\\)\\s*;`));
  });
});

describe('shadow and easing tokens', () => {
  it('declares the three shadows and the three easings inside @theme', () => {
    expect(THEME).toMatch(/--shadow-card:\s*0 1px 2px rgb\(0 0 0 \/ 0\.04\);/);
    expect(THEME).toMatch(/--shadow-seg-active:\s*0 1px 2px rgb\(0 0 0 \/ 0\.06\);/);
    expect(THEME).toMatch(
      /--shadow-pop:\s*0 4px 16px rgb\(0 0 0 \/ 0\.08\),\s*0 1px 2px rgb\(0 0 0 \/ 0\.06\);/,
    );
    expect(THEME).toMatch(/--ease-out:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\);/);
    expect(THEME).toMatch(/--ease-in-out:\s*cubic-bezier\(0\.65, 0, 0\.35, 1\);/);
    expect(THEME).toMatch(/--ease-standard:\s*cubic-bezier\(0\.2, 0, 0, 1\);/);
  });
});

describe('motion tokens', () => {
  const rootBlocks = [...CSS.matchAll(/(^|\n):root\s*\{([^}]*)\}/g)].map((match) => match[2]!);

  it('defines durations, stagger step and press scale on :root', () => {
    const base = rootBlocks[0]!;
    expect(base).toMatch(/--dur-instant:\s*80ms;/);
    expect(base).toMatch(/--dur-fast:\s*140ms;/);
    expect(base).toMatch(/--dur-base:\s*220ms;/);
    expect(base).toMatch(/--dur-slow:\s*420ms;/);
    expect(base).toMatch(/--dur-chart:\s*600ms;/);
    expect(base).toMatch(/--stagger-step:\s*28ms;/);
    expect(base).toMatch(/--press-scale:\s*0\.98;/);
  });

  it('zeroes every duration and the stagger, and resets the press scale, under reduced motion', () => {
    const reduced = blockBody(CSS, '@media (prefers-reduced-motion: reduce)');
    for (const name of ['instant', 'fast', 'base', 'slow', 'chart']) {
      expect(reduced).toMatch(new RegExp(`--dur-${name}:\\s*0ms;`));
    }
    expect(reduced).toMatch(/--stagger-step:\s*0ms;/);
    expect(reduced).toMatch(/--press-scale:\s*1;/);
  });
});

describe('motion utilities', () => {
  it.each(['skeleton-sheen', 'enter-rise', 'enter-fade', 'enter-grow'])(
    '%s only animates when the viewer has not asked for reduced motion',
    (name) => {
      const body = blockBody(CSS, `@utility ${name} {`);
      const gated = blockBody(body, '@media (prefers-reduced-motion: no-preference)');
      expect(gated).toMatch(/animation:/);
      // Nothing outside the gate: reduced motion leaves the element in its final, static state.
      expect(body.replace(gated, '')).not.toMatch(/animation:|background-image:/);
    },
  );

  it('staggers enter-rise by the row index, in stagger steps', () => {
    const body = blockBody(CSS, '@utility enter-rise {');
    expect(body).toMatch(/animation-delay:\s*calc\(var\(--i, 0\) \* var\(--stagger-step\)\)/);
  });

  it('draws the skeleton sheen as base 0%, sheen 40%, base 80% over 300% width', () => {
    const body = blockBody(CSS, '@utility skeleton-sheen {');
    expect(body).toMatch(
      /linear-gradient\(\s*90deg,\s*var\(--color-skeleton-base\) 0%,\s*var\(--color-skeleton-sheen\) 40%,\s*var\(--color-skeleton-base\) 80%\s*\)/,
    );
    expect(body).toMatch(/background-size:\s*300% 100%/);
    expect(body).toMatch(/1\.4s var\(--ease-in-out\) infinite/);
  });
});
