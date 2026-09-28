import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Loads one captured fixture from `e2e/fixtures/<name>` — a real response
 * this project's own backend returned for a fixed request, saved verbatim
 * (only unused, response-irrelevant fields trimmed; see each capture's own
 * git history). Read from disk with plain `fs`/`JSON.parse` rather than a
 * TypeScript JSON import: this project's Node-typed e2e `tsconfig` has no
 * `resolveJsonModule`, and adding one only for a handful of test fixtures
 * would be a larger, unrelated config change for the same result.
 */
export function loadFixture<T>(name: string): T {
  const path = fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}
