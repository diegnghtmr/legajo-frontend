import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

function extractFontSansFamilies(css: string): string[] {
  const match = css.match(/--font-sans:\s*([^;]+);/);
  if (!match?.[1]) throw new Error('--font-sans not found in index.css');

  return match[1].split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, ''));
}

function extractRegisteredFamily(metadataJson: string): string {
  const metadata = JSON.parse(metadataJson) as { family?: string };
  if (!metadata.family) throw new Error('"family" not found in fontsource metadata.json');

  return metadata.family;
}

describe('sans webfont registration', () => {
  it('names the loaded --font-sans face after the family @fontsource/geist-sans registers', () => {
    const indexCss = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
    const fontsourceMetadata = readFileSync(
      join(ROOT, 'node_modules', '@fontsource', 'geist-sans', 'metadata.json'),
      'utf8',
    );

    const [loadedFamily] = extractFontSansFamilies(indexCss);
    const registeredFamily = extractRegisteredFamily(fontsourceMetadata);

    // index.css imports @fontsource/geist-sans's @font-face rules, which
    // register the family "Geist Sans", not "Geist" — so --font-sans must
    // name the same family the imported @font-face actually registers, or
    // every sans element silently falls back to the next family in the stack.
    expect(loadedFamily).toBe(registeredFamily);
  });
});
