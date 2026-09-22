export type ClassValue =
  string | number | null | undefined | false | Record<string, boolean | undefined>;

/**
 * Minimal class-name joiner: no `clsx`/`tailwind-merge` dependency, since
 * neither is part of the frontend's fixed stack (TRD §5.2). It never
 * deduplicates or resolves Tailwind conflicts — components here never pass
 * conflicting utility classes for the same property.
 */
export function cn(...values: readonly ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value === 'string' || typeof value === 'number') {
      classes.push(String(value));
      continue;
    }

    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) classes.push(key);
    }
  }

  return classes.join(' ');
}
