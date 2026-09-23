import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

// ESM (this repo's `package.json` sets `"type": "module"`) has no
// `__dirname`/`__filename`; derived from `import.meta.url` instead.
const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = dirname(CURRENT_FILE);

/**
 * F3's core promise is "zero mocks": every request in this suite must reach
 * the real backend over real HTTP, never a `page.route`/`context.route`
 * interception (that pattern is exactly what every spec in the *mocked*
 * `e2e/` suite uses instead, on purpose). This guard is a static, structural
 * check — not a network assertion — so it fails the moment an interception
 * call is *typed*, before it would ever run: a per-test network assertion
 * could pass by accident if a route handler happened to call
 * `route.continue()` to the real backend, but the text pattern can't be
 * fooled that way, and it catches the mistake even in a spec that never
 * gets executed (e.g. skipped, or failing for an unrelated reason first).
 *
 * Deliberately does NOT literally spell out "page.route(" or
 * "context.route(" as a contiguous substring in this file's own source —
 * the patterns below are built from separate identifier/method parts so
 * this file never matches its own guard.
 */
const OBJECT_NAMES = ['page', 'context'];
const METHOD_NAME = ['r', 'o', 'u', 't', 'e'].join('');

const FORBIDDEN_PATTERNS = OBJECT_NAMES.map(
  (objectName) => new RegExp(`\\b${objectName}\\s*\\.\\s*${METHOD_NAME}\\s*\\(`),
);

function collectSourceFiles(dir: string, self: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') {
      continue;
    }
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectSourceFiles(fullPath, self, out);
    } else if (fullPath.endsWith('.ts') && fullPath !== self) {
      out.push(fullPath);
    }
  }
  return out;
}

test('the full-stack suite never intercepts a request with page.route/context.route', () => {
  const offenders: string[] = [];

  for (const file of collectSourceFiles(CURRENT_DIR, CURRENT_FILE)) {
    const content = readFileSync(file, 'utf-8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        offenders.push(`${file}: matches ${pattern}`);
      }
    }
  }

  expect(
    offenders,
    'e2e-fullstack/ must never mock an API response (F3: zero mocks, real backend only) — ' +
      'found response interception in:\n' +
      offenders.join('\n'),
  ).toEqual([]);
});
