import type { Locator } from '@playwright/test';

/** The handful of DOM members this file's own browser-side callback needs,
 * spelled out locally rather than adding the `dom` lib (which this
 * project's Node-typed e2e tsconfig deliberately omits) — the same
 * technique `textOverlap.ts`'s own `OverlapElement` already uses. */
interface ClipRect {
  width: number;
  height: number;
}
interface ClipElement {
  tagName: string;
  textContent: string | null;
  closest(selector: string): ClipElement | null;
  getBoundingClientRect(): ClipRect;
}
interface ClipRoot {
  querySelectorAll(selector: string): ArrayLike<ClipElement>;
}

export interface SrOnlyCaptionViolation {
  caption: string;
  reason: string;
}

/**
 * Tailwind's `sr-only` (`position: absolute; width: 1px; height: 1px;
 * overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;`) clips an
 * ordinary element to its own ~1x1px border box regardless of how much
 * content overflows it — verified directly: a `<div class="sr-only">`
 * always reports a 1x1 `getBoundingClientRect()` no matter what it wraps,
 * and a bare `<caption class="sr-only">` self-clips the same way.
 *
 * A `<table>` is the one element this does NOT hold for. Per the CSS table
 * box model, a table generates two boxes: an anonymous "table wrapper box"
 * that takes the element's `position`/`margin`, and the "table box" proper
 * that takes `width`/`height`/`overflow` — so `sr-only` on a `<table>`
 * clips only the table box (the grid of rows/cells). Its own `<caption>` is
 * laid out as a sibling of the table box *inside* the wrapper box, which has
 * no width/height/overflow restriction of its own, so the caption renders
 * at its natural size instead of being clipped — verified directly: a
 * `<table class="sr-only">` with a long caption measures the caption's own
 * multi-line, wrapped box (tens to hundreds of px), while the same content
 * wrapped in a plain `<div class="sr-only"><table>…</table></div>` measures
 * ~1x1px for the wrapping div.
 *
 * This walks every `<caption>` under `container` to its nearest `sr-only`
 * ancestor-or-self (DOM `closest`, which finds `<table class="sr-only">` as
 * a caption's real DOM parent even though the CSS wrapper-box split above
 * keeps them visually apart) and fails whenever that holder is a `<table>`
 * (the antipattern itself, however wide the escape) or renders wider/taller
 * than a small tolerance (any other element that should have self-clipped
 * but somehow did not).
 */
export async function expectNoEscapingSrOnlyCaptions(container: Locator): Promise<void> {
  const violations = await container.evaluate((root: ClipRoot): SrOnlyCaptionViolation[] => {
    const TOLERANCE_PX = 1.5;
    const found: SrOnlyCaptionViolation[] = [];
    const captions = root.querySelectorAll('caption');
    for (let i = 0; i < captions.length; i += 1) {
      const caption = captions[i]!;
      const text = (caption.textContent ?? '').trim();
      const holder = caption.closest('.sr-only');
      if (!holder) {
        found.push({
          caption: text,
          reason: 'no sr-only ancestor found — caption is fully visible',
        });
        continue;
      }
      if (holder.tagName === 'TABLE') {
        found.push({
          caption: text,
          reason:
            '`sr-only` sits on the `<table>` element itself, which never clips its own `<caption>` (CSS table wrapper-box split)',
        });
        continue;
      }
      const rect = holder.getBoundingClientRect();
      if (rect.width > TOLERANCE_PX || rect.height > TOLERANCE_PX) {
        found.push({
          caption: text,
          reason: `sr-only ancestor <${holder.tagName.toLowerCase()}> renders at ${rect.width.toFixed(1)}x${rect.height.toFixed(1)}px instead of clipping to ~1x1px`,
        });
      }
    }
    return found;
  });

  if (violations.length > 0) {
    const lines = violations.map((v) => `  "${v.caption}": ${v.reason}`);
    throw new Error(`Found ${violations.length} escaping sr-only caption(s):\n${lines.join('\n')}`);
  }
}
