import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

function extractFontSansFamilies(css: string): string[] {
  const match = css.match(/--font-sans:\s*([^;]+);/);
  if (!match?.[1]) throw new Error('--font-sans not found in index.css');

  return match[1].split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, ''));
}

// Strips CSS block comments, so a commented-out @import is never mistaken for a live one.
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Finds index.css's `@import '@fontsource/geist-sans/...'` and returns the
 * imported file's path under node_modules, so a caller can read the actual
 * @font-face rule that registers the sans face instead of trusting a
 * separately-read package metadata file that could agree with --font-sans
 * by coincidence even if the import itself were missing, removed, or only
 * commented out. Throws when no live import is found, which is exactly the
 * gap this check must catch: a --font-sans that merely names the right
 * family without ever loading the @font-face rule that registers it.
 */
function extractFontsourceImportPath(css: string): string {
  const match = stripCssComments(css).match(
    /@import\s+['"]@fontsource\/geist-sans\/([^'"]+)['"]\s*;/,
  );
  if (!match?.[1]) {
    throw new Error("index.css does not @import '@fontsource/geist-sans/...'");
  }

  return join('@fontsource', 'geist-sans', match[1]);
}

function extractFontFaceFamily(fontFaceCss: string): string {
  const match = fontFaceCss.match(/font-family:\s*'([^']+)'/);
  if (!match?.[1]) throw new Error('font-family not found in the imported @font-face rule');

  return match[1];
}

describe('sans webfont registration', () => {
  it('names the loaded --font-sans face after the family the actually-imported @font-face registers', () => {
    const indexCss = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
    const importedPath = extractFontsourceImportPath(indexCss);
    const fontFaceCss = readFileSync(join(ROOT, 'node_modules', importedPath), 'utf8');

    const [loadedFamily] = extractFontSansFamilies(indexCss);
    const registeredFamily = extractFontFaceFamily(fontFaceCss);

    expect(loadedFamily).toBe(registeredFamily);
  });

  it('catches a --font-sans that names the right family but never imports @fontsource/geist-sans', () => {
    // Stands in for index.css with the geist-sans import commented out (or
    // removed): the family name alone is not proof the face is loaded.
    const cssWithoutImport = `
      @import 'tailwindcss';
      /* @import '@fontsource/geist-sans/400.css'; */
      @theme {
        --font-sans: 'Geist Sans', 'Inter', ui-sans-serif, system-ui, sans-serif;
      }
    `;

    expect(() => extractFontsourceImportPath(cssWithoutImport)).toThrow(
      /does not @import '@fontsource\/geist-sans/,
    );
  });
});
