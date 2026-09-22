import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped payloads (TRD §6.6 `GET /corpus`, `GET /corpus/{id}`) —
 * no live backend: `page.route` intercepts every request so this suite runs
 * fully offline, per the task's e2e instructions.
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

async function mockCorpusApi(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/corpus/doc-01', async (route) => {
    await route.fulfill({ json: CORPUS_DOCUMENT });
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
