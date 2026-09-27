import { expect, type Page } from '@playwright/test';

/** The handful of DOM members this file's own browser-side callback needs,
 * spelled out locally rather than adding the `dom` lib (which this
 * project's Node-typed e2e tsconfig deliberately omits, per
 * `tsconfig.node.json`) — the same technique `textOverlap.ts`'s own
 * `OverlapElement`/`OverlapDocument` interfaces already use. */
interface LoadingTextNode {
  nodeType: number;
  textContent: string | null;
}
interface LoadingTextElement {
  childNodes: ArrayLike<LoadingTextNode>;
  closest(selector: string): LoadingTextElement | null;
}
interface LoadingTextNodeList {
  forEach(callback: (element: LoadingTextElement) => void): void;
}
interface LoadingTextDocument {
  querySelectorAll(selector: string): LoadingTextNodeList;
}

/**
 * Fails if any of the given loading sentences appears as VISIBLE text
 * (never inside an `.sr-only` element) anywhere on the page — the same
 * "own direct text, `sr-only` excluded" method `expectNoTextOverlap` uses.
 */
export async function expectLoadingSentencesHidden(
  page: Page,
  sentences: readonly string[],
): Promise<void> {
  const visible = await page.evaluate((candidates: readonly string[]) => {
    const TEXT_NODE = 3;
    const found: string[] = [];
    const doc = (globalThis as unknown as { document: LoadingTextDocument }).document;

    function isVisuallyHidden(el: LoadingTextElement): boolean {
      return el.closest('.sr-only') !== null;
    }

    function ownText(el: LoadingTextElement): string {
      let text = '';
      for (let i = 0; i < el.childNodes.length; i += 1) {
        const node = el.childNodes[i]!;
        if (node.nodeType === TEXT_NODE) {
          text += node.textContent ?? '';
        }
      }
      return text.trim();
    }

    doc.querySelectorAll('*').forEach((el) => {
      const text = ownText(el);
      if (text && candidates.includes(text) && !isVisuallyHidden(el)) {
        found.push(text);
      }
    });

    return found;
  }, sentences);

  expect(visible, `visible loading text: ${visible.join(', ')}`).toEqual([]);
}
