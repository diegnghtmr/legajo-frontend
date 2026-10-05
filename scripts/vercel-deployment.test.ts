import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const config: unknown = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'vercel.json'), 'utf8'),
);

describe('Vercel deployment configuration', () => {
  it('enables only main and disables all other branches without extra enabled rules', () => {
    expect(config).toHaveProperty('git.deploymentEnabled', {
      main: true,
      '*': false,
    });
  });

  it('retains the catch-all SPA fallback to index.html', () => {
    const rewrites = [{ source: '/(.*)', destination: '/index.html' }];
    expect(config).toHaveProperty('rewrites', rewrites);
  });
});
