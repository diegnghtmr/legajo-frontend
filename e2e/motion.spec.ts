import { expect, test, type Locator, type Page } from '@playwright/test';

import { holdApi } from './support/holdApi.js';

/** The e2e tsconfig omits the DOM lib, so the browser global is typed here. */
type StyleProps = Record<string, string>;
interface StyleWindow {
  getComputedStyle(element: unknown): StyleProps;
}

/** Reads computed style properties from the page, keyed by the given names. */
async function computedStyle(locator: Locator, names: readonly string[]): Promise<StyleProps> {
  return locator.evaluate((element, wanted) => {
    const win = (globalThis as unknown as { window: StyleWindow }).window;
    const style = win.getComputedStyle(element);
    return Object.fromEntries(wanted.map((name) => [name, style[name] ?? '']));
  }, names);
}

const CORPUS = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['B. Two'] },
];

const EMBEDDINGS_STATUS = {
  embeddingLocal: {
    provider: 'p',
    model: 'm',
    dimension: 3,
    corpusSha256: 'a',
    matchesCorpus: true,
    device: 'cpu',
  },
  embeddingApi: {
    provider: 'p',
    model: 'm',
    dimension: 3,
    corpusSha256: 'a',
    matchesCorpus: true,
    mode: 'cached',
  },
};

// The suite default is reduced motion (see playwright.config.ts); these cases
// exercise the motion itself, and switch back to reduced motion where asked.
test.use({ reducedMotion: 'no-preference' });

async function mockShell(page: Page) {
  await page.route('**/api/v1/corpus', (route) => route.fulfill({ json: CORPUS }));
  await page.route('**/api/v1/embeddings/status', (route) =>
    route.fulfill({ json: EMBEDDINGS_STATUS }),
  );
  await page.route('**/api/v1/similarity/algorithms', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/clustering', (route) => route.fulfill({ json: [] }));
}

test.describe('skeleton shimmer', () => {
  async function skeletonStyle(page: Page) {
    await holdApi(page, [{ pattern: '**/api/v1/corpus', json: CORPUS }]);
    await page.route('**/api/v1/embeddings/status', (route) =>
      route.fulfill({ json: EMBEDDINGS_STATUS }),
    );
    await page.goto('/similarity');
    const block = page.locator('[data-slot="skeleton"]').first();
    await expect(block).toBeVisible();
    return computedStyle(block, ['backgroundImage', 'animationName', 'backgroundColor']);
  }

  test('moves a sheen gradient across the hairline base by default', async ({ page }) => {
    const style = await skeletonStyle(page);

    expect(style.backgroundImage).toContain('linear-gradient');
    expect(style.animationName).toBe('shimmer');
  });

  test('is a static hairline fill with no gradient under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const style = await skeletonStyle(page);

    expect(style.backgroundImage).toBe('none');
    expect(style.animationName).toBe('none');
    expect(style.backgroundColor).toBe('rgb(229, 229, 229)');
  });
});

test.describe('top bar', () => {
  test.beforeEach(async ({ page }) => {
    await mockShell(page);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('shows the mark at 26px before the lowercase wordmark, both inside the home link', async ({
    page,
  }) => {
    await page.goto('/similarity');

    const home = page.getByRole('link', { name: 'legajo' });
    await expect(home).toHaveAttribute('href', '/');
    const mark = home.locator('img');
    await expect(mark).toHaveAttribute('alt', '');
    const box = await mark.boundingBox();
    expect(box?.width).toBe(26);
    expect(box?.height).toBe(26);
    await expect(page.getByRole('heading', { level: 1, name: 'legajo' })).toBeVisible();
  });

  test('slides the nav pill under the current link when the route changes', async ({ page }) => {
    await page.goto('/similarity');
    const pill = page.locator('[data-slot="nav-pill"]');
    await expect(pill).toBeVisible();

    /** Largest gap between the pill's box and the link's, in px. */
    async function gapTo(linkName: string) {
      const link = await page.getByRole('link', { name: linkName }).boundingBox();
      const box = await pill.boundingBox();
      if (!link || !box) return Number.POSITIVE_INFINITY;
      return Math.max(Math.abs(box.x - link.x), Math.abs(box.width - link.width));
    }

    // Polled: the pill eases into place over the base duration.
    await expect.poll(() => gapTo('Similitud')).toBeLessThan(1.5);

    await page.getByRole('link', { name: 'Benchmarks' }).click();
    await expect(page.getByRole('link', { name: 'Benchmarks' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect.poll(() => gapTo('Benchmarks')).toBeLessThan(1.5);
  });

  test('jumps the pill without a transition under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/similarity');

    const { transitionDuration } = await computedStyle(page.locator('[data-slot="nav-pill"]'), [
      'transitionDuration',
    ]);
    expect(transitionDuration.split(',').every((part) => part.trim() === '0s')).toBe(true);
  });

  test('keeps the pill off the collapsed menu below 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/similarity');

    await expect(page.locator('[data-slot="nav-pill"]')).toBeHidden();
  });
});
