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
 * the real backend over real HTTP, never an interception or a fake response
 * source (that pattern is exactly what every spec in the *mocked* `e2e/`
 * suite uses instead, on purpose). This guard is a static, structural
 * check — not a network assertion — so it fails the moment an interception
 * call is *typed*, before it would ever run: a per-test network assertion
 * could pass by accident if a route handler happened to call
 * `route.continue()` to the real backend, but the text pattern can't be
 * fooled that way, and it catches the mistake even in a spec that never
 * gets executed (e.g. skipped, or failing for an unrelated reason first).
 *
 * An earlier, narrower version of this guard only matched literal
 * `page.route(`/`context.route(` and missed every other interception shape:
 * a differently named Page/BrowserContext receiver (`myPage.route(...)`), a
 * bracket-notation call (`page['route'](...)`), `.routeFromHAR(...)` (HAR
 * replay — the same "fake the response" intent under a different method
 * name), `.setExtraHTTPHeaders(...)` (a common way to smuggle a header a
 * dev proxy/mock server keys off of), an MSW import (`from 'msw'`/
 * `'msw/browser'`), or a hand-rolled Service Worker mock
 * (`serviceWorker.register(...)`). `PATTERN_COVERAGE` below documents and
 * tests each of these forms individually, so a regression in any one of
 * them fails its own named test, not just a generic "the guard broke".
 *
 * Deliberately does NOT literally spell out "page.route(" or
 * "context.route(" as a contiguous substring in this file's own source —
 * the patterns below are built with `\s*` gaps around the object/method
 * boundary so this file never matches its own guard (it is excluded from
 * the scan below anyway, but keeping the source itself clean of the
 * literal text is a second, independent safeguard).
 */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  // `.route(...)` on ANY receiver, not just `page`/`context` — a renamed or
  // destructured Page/BrowserContext variable must not slip past.
  /\.\s*route\s*\(/,
  // Bracket-notation property access: page['route'](...) / page["route"](...)
  /\[\s*['"]route['"]\s*\]\s*\(/,
  // .routeFromHAR(...) — HAR-replay mocking, a separate Playwright API with
  // the same "fake the response" intent this guard forbids.
  /\.\s*routeFromHAR\s*\(/,
  // .setExtraHTTPHeaders(...) — not response mocking on its own, but a
  // common way to smuggle a header a dev proxy/mock server keys off of; this
  // suite has no legitimate reason to touch request headers at all.
  /\.\s*setExtraHTTPHeaders\s*\(/,
  // Any import from the "msw" (Mock Service Worker) package, browser or
  // node build.
  /from\s+['"]msw(\/[^'"]*)?['"]/,
  // The browser Service Worker API a hand-rolled service-worker mock would
  // register through.
  /\bserviceWorker\s*\.\s*register\s*\(/,
];

/**
 * One sample per forbidden form, each verified below to be caught by
 * `FORBIDDEN_PATTERNS` — and two samples that must NOT be caught, so
 * widening the patterns never starts flagging ordinary, unrelated code
 * (e.g. a router hook or a variable that merely contains the word "route").
 */
const PATTERN_COVERAGE: ReadonlyArray<{
  label: string;
  sample: string;
  shouldMatch: boolean;
}> = [
  { label: 'page.route(...)', sample: "await page.route('**/api', handler);", shouldMatch: true },
  {
    label: 'context.route(...)',
    sample: 'await context.route(pattern, handler);',
    shouldMatch: true,
  },
  {
    label: 'a differently named Page/BrowserContext receiver',
    sample: 'await myPage.route(url, fn);',
    shouldMatch: true,
  },
  {
    label: 'odd spacing around the dot/parens',
    sample: 'await page . route ( url, fn );',
    shouldMatch: true,
  },
  {
    label: 'a bracket-notation call',
    sample: "await page['route'](url, fn);",
    shouldMatch: true,
  },
  {
    label: 'routeFromHAR(...)',
    sample: 'await context.routeFromHAR(harPath);',
    shouldMatch: true,
  },
  {
    label: 'setExtraHTTPHeaders(...)',
    sample: "await page.setExtraHTTPHeaders({ 'x-mock': '1' });",
    shouldMatch: true,
  },
  {
    label: 'an MSW bare import',
    sample: "import { rest } from 'msw';",
    shouldMatch: true,
  },
  {
    label: 'an MSW browser import',
    sample: "import { setupWorker } from 'msw/browser';",
    shouldMatch: true,
  },
  {
    label: 'a service-worker mock registration',
    sample: "navigator.serviceWorker.register('/mock-sw.js');",
    shouldMatch: true,
  },
  {
    label: 'an unrelated router hook (must NOT match)',
    sample: "const navigate = useNavigate(); navigate('/route');",
    shouldMatch: false,
  },
  {
    label: 'an unrelated variable named routeInfo (must NOT match)',
    sample: 'const routeInfo = getRouteInfo();',
    shouldMatch: false,
  },
];

for (const { label, sample, shouldMatch } of PATTERN_COVERAGE) {
  test(`forbidden-pattern coverage: ${shouldMatch ? 'catches' : 'ignores'} ${label}`, () => {
    const matched = FORBIDDEN_PATTERNS.some((pattern) => pattern.test(sample));
    expect(matched).toBe(shouldMatch);
  });
}

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
  const scannedFiles = collectSourceFiles(CURRENT_DIR, CURRENT_FILE);
  // A guard that scans zero files proves nothing — it would pass just as
  // "cleanly" as a guard that scanned every real spec and found no
  // offenders, silently turning into a no-op if `collectSourceFiles` ever
  // regressed (wrong directory, an overly broad exclusion, all files
  // filtered out) without anyone noticing. Bounded below by the suite's own
  // known minimum: this file is excluded from its own scan, so the count is
  // the other five (corpus/similarity/clustering/benchmarks specs plus
  // support/backend.ts).
  expect(
    scannedFiles.length,
    'the guard scanned zero .ts files under e2e-fullstack/ — that proves nothing about mocking; check collectSourceFiles',
  ).toBeGreaterThanOrEqual(5);

  const offenders: string[] = [];
  for (const file of scannedFiles) {
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
