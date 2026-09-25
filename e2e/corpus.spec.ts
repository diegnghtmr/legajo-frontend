import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped payloads (`GET /corpus`, `GET /corpus/{id}`) —
 * no live backend: `page.route` intercepts every request so this suite runs
 * fully offline.
 */
const CORPUS_SUMMARIES = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One', 'B. Two'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['C. Three'] },
];

const CORPUS_DOCUMENT = {
  id: 'doc-01',
  title: 'A survey of string similarity',
  authors: ['A. One', 'B. Two'],
  abstract: 'This paper surveys classic and embedding-based similarity measures.',
};

const EMBEDDINGS_STATUS = {
  embeddingLocal: {
    provider: 'sentence-transformers',
    model: 'all-MiniLM-L6-v2',
    dimension: 384,
    corpusSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    matchesCorpus: true,
    device: 'cpu',
  },
  embeddingApi: {
    provider: 'google',
    model: 'gemini-embedding-2-preview',
    dimension: 1536,
    corpusSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85',
    matchesCorpus: true,
    mode: 'cached',
  },
};

async function mockCorpusApi(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/corpus/doc-01', async (route) => {
    await route.fulfill({ json: CORPUS_DOCUMENT });
  });
  await page.route('**/api/v1/embeddings/status', async (route) => {
    await route.fulfill({ json: EMBEDDINGS_STATUS });
  });
}

test.describe('corpus screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockCorpusApi(page);
  });

  test('loads the corpus list, shows the compare CTA disabled, and opens an article detail', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Legajo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Artículos del corpus' })).toBeVisible();

    const firstLink = page.getByRole('link', { name: 'A survey of string similarity' });
    await expect(firstLink).toBeVisible();
    await expect(page.getByRole('link', { name: 'Embeddings for scientific text' })).toBeVisible();

    const compareButton = page.getByRole('button', { name: 'Comparar' });
    await expect(compareButton).toBeDisabled();
    await expect(page.getByText('Selecciona al menos dos artículos para comparar.')).toBeVisible();

    await firstLink.click();
    await expect(
      page.getByText('This paper surveys classic and embedding-based similarity measures.'),
    ).toBeVisible();

    const firstCheckbox = page.getByRole('checkbox', { name: 'A survey of string similarity' });
    const secondCheckbox = page.getByRole('checkbox', { name: 'Embeddings for scientific text' });
    await firstCheckbox.check();
    await secondCheckbox.check();

    await expect(compareButton).toBeEnabled();
  });

  test('keeps a keyboard-focused row from being obscured by the sticky CTA bar (WCAG 2.4.11)', async ({
    page,
  }) => {
    // A long enough list that its last row starts below the fold at a
    // narrow viewport.
    const manySummaries = Array.from({ length: 15 }, (_unused, index) => ({
      id: `doc-${index + 1}`,
      title: `Article number ${index + 1}`,
      authors: ['A. Author'],
    }));
    await page.route('**/api/v1/corpus', async (route) => {
      await route.fulfill({ json: manySummaries });
    });

    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Artículos del corpus' })).toBeVisible();

    const lastCheckbox = page.getByRole('checkbox', { name: 'Article number 15' });

    // The bug this guards against is invisible to a naive "focus an
    // off-screen element" check: browsers auto-scroll generously (often
    // centering) when a target is *entirely* outside the viewport, which
    // already clears the sticky bar by accident. The real WCAG 2.4.11 gap
    // is the boundary case a plain sequential Tab actually produces — a row
    // whose geometry the browser already considers "fully visible" (its
    // whole box fits within the viewport bounds), so it performs *no*
    // auto-scroll at all, even though the opaque sticky bar paints over it.
    // Reproduce that boundary directly: scroll so the row's bottom edge
    // lands exactly flush with the viewport's bottom edge (computed from
    // its own document-relative position, not a magic constant), then
    // focus it exactly as Tab would.
    // String bodies (not arrow functions) so these evaluate in the browser
    // without pulling the `dom` lib into this project's Node-typed e2e
    // tsconfig (`tsconfig.node.json`).
    await page.evaluate('window.scrollTo(0, 0)');
    const naturalBox = await lastCheckbox.boundingBox();
    expect(naturalBox).not.toBeNull();
    const viewportHeight = page.viewportSize()!.height;
    const flushScrollY = naturalBox!.y + naturalBox!.height - viewportHeight;
    await page.evaluate(`window.scrollTo(0, ${flushScrollY})`);

    await lastCheckbox.focus();
    await expect(lastCheckbox).toBeFocused();

    const barBox = await page.locator('.sticky.bottom-0').first().boundingBox();
    const rowBox = await lastCheckbox.boundingBox();
    expect(barBox).not.toBeNull();
    expect(rowBox).not.toBeNull();
    // The focused checkbox's bottom edge must clear the sticky bar's top
    // edge — never obscured behind it.
    expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(barBox!.y);
  });

  test('shows the embeddings status panel with both families', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Estado de los embeddings' })).toBeVisible();
    await expect(page.getByText('embedding-local')).toBeVisible();
    await expect(page.getByText('embedding-api')).toBeVisible();
    await expect(page.getByText('Coincide con el corpus').first()).toBeVisible();
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the corpus screen', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Artículos del corpus' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  for (const path of ['/corpus/doc-01', '/similarity', '/clustering', '/no-such-route']) {
    test(`has no automatically detectable WCAG 2.1 AA violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
