import type { Locator } from '@playwright/test';

export interface TextOverlapViolation {
  a: string;
  b: string;
  overlapWidth: number;
  overlapHeight: number;
}

export interface ClippedLabel {
  label: string;
}

export interface TextOverlapReport {
  overlaps: TextOverlapViolation[];
  clipped: ClippedLabel[];
}

/** The handful of DOM members this file's own browser-side callback needs,
 * spelled out locally rather than adding the `dom` lib (which this
 * project's Node-typed e2e tsconfig deliberately omits, per
 * `tsconfig.node.json`) — the same technique `hit-areas.spec.ts`'s own
 * `HitSize*` interfaces already use. */
interface OverlapRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
interface OverlapTextNode {
  nodeType: number;
  textContent: string | null;
}
interface OverlapComputedStyle {
  display: string;
  visibility: string;
  opacity: string;
}
interface OverlapWindow {
  getComputedStyle(element: OverlapElement): OverlapComputedStyle;
}
interface OverlapDocument {
  defaultView: OverlapWindow;
}
interface OverlapNodeList {
  forEach(callback: (element: OverlapElement) => void): void;
}
interface OverlapElement {
  tagName: string;
  textContent: string | null;
  childNodes: ArrayLike<OverlapTextNode>;
  ownerDocument: OverlapDocument;
  closest(selector: string): OverlapElement | null;
  getBoundingClientRect(): OverlapRect;
  querySelectorAll(selector: string): OverlapNodeList;
}

interface LabeledRect {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Collects every visible SVG `text`/`tspan` and HTML text label inside
 * `container` — using each one's real rendered `getBoundingClientRect`, not
 * the layout Recharts/D3 *intended* — and reports every pair whose boxes
 * intersect by more than 1px in both axes, plus any SVG text box that falls
 * outside its own nearest `<svg>` ancestor (a label clipped by the chart's
 * own viewport rather than merely overlapping another label).
 *
 * "HTML text label" is any element whose own direct text (`ownText`, never
 * a wrapper's full `textContent`) is non-blank — a `<p>`, a table `<td>`, a
 * legend `<span>`, an axis title rendered outside the SVG. Elements under
 * this project's own `sr-only` convention are excluded: that off-screen
 * text is intentionally never visually rendered, so this guard only ever
 * checks what a sighted viewer would actually see.
 */
export async function findTextOverlaps(container: Locator): Promise<TextOverlapReport> {
  return container.evaluate((root: OverlapElement): TextOverlapReport => {
    // Every helper below is nested INSIDE this one callback on purpose:
    // `Locator.evaluate` serializes only this function's own source text to
    // run in the browser — a helper declared at this module's top level
    // (Node-side) is invisible there, and referencing one throws a
    // `ReferenceError` at evaluation time instead of failing to typecheck.
    // `Node.TEXT_NODE`'s literal value (`3`) is spelled out directly for
    // the same reason the global `Node` constant itself is never read here:
    // this project's own `e2e/**` tsconfig has no `dom` lib.
    const TEXT_NODE = 3;
    const win = root.ownerDocument.defaultView;

    function isVisuallyHidden(el: OverlapElement): boolean {
      return el.closest('.sr-only') !== null;
    }

    function isRendered(el: OverlapElement): boolean {
      const style = win.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      if (Number(style.opacity) === 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    // An element's own *direct* child text nodes only — never its full,
    // aggregated `textContent`, which would make a wrapper trivially
    // "overlap" every one of its own children (and, for an SVG `<text>`
    // whose whole label lives on a child `<tspan>`, would register the
    // same label twice as two always-nested, always-"overlapping" boxes).
    function ownText(el: OverlapElement): string {
      let text = '';
      for (let i = 0; i < el.childNodes.length; i += 1) {
        const node = el.childNodes[i]!;
        if (node.nodeType === TEXT_NODE) {
          text += node.textContent ?? '';
        }
      }
      return text.trim();
    }

    const rects: LabeledRect[] = [];
    const clipped: ClippedLabel[] = [];

    root.querySelectorAll('text, tspan').forEach((el) => {
      if (isVisuallyHidden(el) || !isRendered(el)) {
        return;
      }
      // `ownText` only — never a `textContent` fallback: see its own doc
      // comment above for why a `<text>`/`<tspan>` pair would otherwise
      // always register as a false-positive self-overlap.
      const label = ownText(el);
      if (!label) {
        return;
      }
      const rect = el.getBoundingClientRect();
      rects.push({ label, x: rect.x, y: rect.y, width: rect.width, height: rect.height });

      const svg = el.closest('svg');
      if (svg) {
        const svgRect = svg.getBoundingClientRect();
        const isClipped =
          rect.left < svgRect.left - 0.5 ||
          rect.right > svgRect.right + 0.5 ||
          rect.top < svgRect.top - 0.5 ||
          rect.bottom > svgRect.bottom + 0.5;
        if (isClipped) {
          clipped.push({ label });
        }
      }
    });

    root.querySelectorAll('*').forEach((el) => {
      if (el.tagName === 'SVG' || el.closest('svg')) {
        // SVG content is covered by the text/tspan pass above; an HTML
        // wrapper around an inline SVG (e.g. the legend swatches) carries
        // no text of its own there.
        return;
      }
      if (isVisuallyHidden(el) || !isRendered(el)) {
        return;
      }
      const label = ownText(el);
      if (!label) {
        return;
      }
      const rect = el.getBoundingClientRect();
      rects.push({ label, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    });

    const overlaps: TextOverlapViolation[] = [];
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapWidth > 1 && overlapHeight > 1) {
          overlaps.push({ a: a.label, b: b.label, overlapWidth, overlapHeight });
        }
      }
    }

    return { overlaps, clipped };
  });
}

function formatReport(report: TextOverlapReport): string {
  const lines: string[] = [];
  for (const violation of report.overlaps) {
    lines.push(
      `  "${violation.a}" × "${violation.b}" overlap by ${violation.overlapWidth.toFixed(1)}×${violation.overlapHeight.toFixed(1)}px`,
    );
  }
  for (const entry of report.clipped) {
    lines.push(`  "${entry.label}" is clipped outside its own SVG`);
  }
  return lines.join('\n');
}

/**
 * Fails the test with a readable message naming every overlapping pair (or
 * clipped label) `findTextOverlaps` found inside `container`: a
 * programmatic overlap guard applied to every chart/visual container — the
 * benchmark curve charts, the dendrograms, the similarity matrix and the DP
 * trace matrix.
 */
export async function expectNoTextOverlap(container: Locator): Promise<void> {
  const report = await findTextOverlaps(container);
  const violationCount = report.overlaps.length + report.clipped.length;
  if (violationCount > 0) {
    throw new Error(`Found ${violationCount} text overlap violation(s):\n${formatReport(report)}`);
  }
}
