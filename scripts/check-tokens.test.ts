import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findViolations } from './check-tokens.ts';

describe('findViolations', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'check-tokens-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('passes a clean tree with no hex literals outside @theme', () => {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(
      join(root, 'src', 'index.css'),
      `@theme {\n  --color-ink: #171717;\n}\n\n.body { color: var(--color-ink); }\n`,
    );
    writeFileSync(
      join(root, 'src', 'App.tsx'),
      `export function App() {\n  return <div className="text-ink">hi</div>;\n}\n`,
    );
    mkdirSync(join(root, 'src', 'shared', 'types'), { recursive: true });
    writeFileSync(
      join(root, 'src', 'shared', 'types', 'api.ts'),
      `// generated\nexport const HEX_IN_GENERATED = '#abcdef';\n`,
    );

    expect(findViolations(join(root, 'src'))).toEqual([]);
  });

  it('reports a hex literal in a component outside the @theme block', () => {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'index.css'), `@theme {\n  --color-ink: #171717;\n}\n`);
    writeFileSync(
      join(root, 'src', 'Bad.tsx'),
      `export function Bad() {\n  return <div style={{ color: '#ff0000' }}>bad</div>;\n}\n`,
    );

    const violations = findViolations(join(root, 'src'));

    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toContain('Bad.tsx');
    expect(violations[0]?.match).toBe('#ff0000');
  });

  it('reports a hex literal added to index.css outside the @theme block', () => {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(
      join(root, 'src', 'index.css'),
      `@theme {\n  --color-ink: #171717;\n}\n\n.leak { color: #00ff00; }\n`,
    );

    const violations = findViolations(join(root, 'src'));

    expect(violations).toHaveLength(1);
    expect(violations[0]?.match).toBe('#00ff00');
    // Stripping the @theme block must not shift line numbers: the leak is on line 5.
    expect(violations[0]?.line).toBe(5);
  });
});
