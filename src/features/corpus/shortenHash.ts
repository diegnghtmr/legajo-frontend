const VISIBLE_PREFIX = 8;
const VISIBLE_SUFFIX = 6;
const MIN_LENGTH_TO_SHORTEN = VISIBLE_PREFIX + VISIBLE_SUFFIX + 1;

/**
 * Shortens a `corpusSha256` digest for display: the full value
 * stays available via `title`/sr-only text wherever this is used,
 * this only trims the visible glyph count. A digest at or below the
 * combined prefix+suffix length is returned verbatim — shortening it would
 * not save any characters.
 */
export function shortenHash(hash: string): string {
  if (hash.length <= MIN_LENGTH_TO_SHORTEN) {
    return hash;
  }
  return `${hash.slice(0, VISIBLE_PREFIX)}…${hash.slice(-VISIBLE_SUFFIX)}`;
}
