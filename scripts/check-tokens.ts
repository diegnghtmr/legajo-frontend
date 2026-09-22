import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, sep } from 'node:path';

export interface TokenViolation {
  file: string;
  line: number;
  match: string;
}

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const HEX_PATTERN = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const GENERATED_SUFFIX = join('shared', 'types', 'api.ts');

function listFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (SCANNED_EXTENSIONS.has(extname(fullPath))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Strips every `@theme { ... }` block from a CSS source so hex literals
 * declared as design tokens are not reported as violations. Brace-balanced,
 * so nested `{}` inside the block (there are none in practice) stay safe.
 */
export function stripThemeBlocks(css: string): string {
  let result = '';
  let cursor = 0;

  while (cursor < css.length) {
    const themeStart = css.indexOf('@theme', cursor);
    if (themeStart === -1) {
      result += css.slice(cursor);
      break;
    }

    const braceOpen = css.indexOf('{', themeStart);
    if (braceOpen === -1) {
      result += css.slice(cursor);
      break;
    }

    result += css.slice(cursor, themeStart);

    let depth = 1;
    let index = braceOpen + 1;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    }

    // Keep the block's newlines so violations after it report their real line.
    result += css.slice(themeStart, index).replace(/[^\n]/g, '');
    cursor = index;
  }

  return result;
}

export function findViolations(rootDir: string): TokenViolation[] {
  const violations: TokenViolation[] = [];

  for (const file of listFiles(rootDir)) {
    if (file.endsWith(GENERATED_SUFFIX)) continue;

    const raw = readFileSync(file, 'utf8');
    const content = extname(file) === '.css' ? stripThemeBlocks(raw) : raw;

    content.split('\n').forEach((lineText, index) => {
      const matches = lineText.match(HEX_PATTERN);
      if (!matches) return;
      for (const match of matches) {
        violations.push({ file, line: index + 1, match });
      }
    });
  }

  return violations;
}

function main(): void {
  const srcDir = join(process.cwd(), 'src');
  const violations = findViolations(srcDir);

  if (violations.length > 0) {
    console.error('check:tokens: hex color literals found outside src/index.css @theme block:\n');
    for (const violation of violations) {
      console.error(`  ${violation.file}:${violation.line}  ${violation.match}`);
    }
    console.error(`\n${violations.length} violation(s). Move the value into the @theme block.`);
    process.exit(1);
  }

  console.log('check:tokens: no hex color literals outside @theme.');
}

const isDirectRun = process.argv[1]?.endsWith(`${sep}check-tokens.ts`);
if (isDirectRun) {
  main();
}
