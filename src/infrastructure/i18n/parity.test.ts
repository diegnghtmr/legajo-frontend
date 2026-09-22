import { describe, expect, it } from 'vitest';

import en from './locales/en.json';
import es from './locales/es.json';

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      keys.push(...flattenKeys(nested as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }

  return keys;
}

describe('i18n resource parity (TAC-16)', () => {
  it('ES and EN expose exactly the same non-empty key set', () => {
    const esKeys = flattenKeys(es).sort();
    const enKeys = flattenKeys(en).sort();

    expect(esKeys.length).toBeGreaterThan(0);
    expect(esKeys).toEqual(enKeys);
  });
});
