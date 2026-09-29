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

test.describe('corpus selection rail', () => {
  test.beforeEach(async ({ page }) => {
    await mockCorpusApi(page);
  });

  test('loads the corpus list in the rail, shows the adaptive CTA disabled, and opens an article abstract', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Legajo' })).toBeVisible();

    const firstTitle = page.getByRole('button', { name: 'A survey of string similarity' });
    await expect(firstTitle).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Embeddings for scientific text' }),
    ).toBeVisible();

    const compareButton = page.getByRole('button', { name: 'Comparar' });
    await expect(compareButton).toBeDisabled();
    await expect(page.getByText('Selecciona al menos 2 para comparar.')).toBeVisible();

    await firstTitle.click();
    await expect(
      page.getByText('This paper surveys classic and embedding-based similarity measures.'),
    ).toBeVisible();

    const firstCheckbox = page.getByRole('checkbox', { name: 'A survey of string similarity' });
    const secondCheckbox = page.getByRole('checkbox', { name: 'Embeddings for scientific text' });
    await firstCheckbox.check();
    await secondCheckbox.check();

    await expect(page.getByRole('button', { name: 'Comparar doc-01 y doc-02' })).toBeEnabled();
  });

  test('the search filters rows without deselecting a hidden selection', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();

    await page.getByRole('searchbox', { name: /buscar/i }).fill('embeddings');
    await expect(page.getByText('A survey of string similarity')).toHaveCount(0);
    await expect(
      page.getByRole('checkbox', { name: 'Embeddings for scientific text' }),
    ).toBeVisible();

    await page.getByRole('searchbox', { name: /buscar/i }).fill('');
    await expect(
      page.getByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeChecked();
  });

  test('selecting three or more never lands on a wrong-count dead end: the matrix shows directly, with no click needed', async ({
    page,
  }) => {
    const summaries = [
      ...CORPUS_SUMMARIES,
      { id: 'doc-03', title: 'Clustering theory refresher', authors: ['D. Four'] },
    ];
    await page.route('**/api/v1/corpus', async (route) => {
      await route.fulfill({ json: summaries });
    });
    function cell(normalizedScore: number) {
      return {
        normalizedScore,
        rawValue: normalizedScore,
        computedNanos: 4200,
        cached: false,
        degenerate: false,
      };
    }
    const matrix = [
      [cell(1), cell(0.5), cell(0.3)],
      [cell(0.5), cell(1), cell(0.4)],
      [cell(0.3), cell(0.4), cell(1)],
    ];
    await page.route('**/api/v1/similarity/matrix', async (route) => {
      await route.fulfill({ json: matrix });
    });

    await page.goto('/');
    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('checkbox', { name: 'Clustering theory refresher' }).check();

    // The center follows the selection automatically at this width — the
    // matrix already shows before the CTA is ever activated, still on the
    // plain `/similarity` URL, never a dead end and never a separate route
    // to navigate to first.
    await expect(page).toHaveURL(/\/similarity$/);
    await expect(page.getByRole('heading', { name: 'Matriz de similitud' })).toBeVisible();
    // The dead end this guards against was the old "wrong count" empty
    // state (an exact string, never a "Comparar" click routing anywhere
    // else): the matrix itself must render instead, with its real values.
    await expect(
      page.getByText(
        'Selecciona 2 artículos en el panel para comparar, o 3 o más para ver la matriz.',
      ),
    ).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('1.000').first()).toBeVisible();

    // The rail's CTA stays enabled and, once activated, no longer needs to
    // navigate anywhere — the keyboard/assistive-technology path onto
    // results already on screen (`useAdaptiveSelectionCta`).
    const matrixButton = page.getByRole('button', { name: 'Ver matriz de 3' });
    await expect(matrixButton).toBeEnabled();
    await matrixButton.click();
    await expect(page).toHaveURL(/\/similarity$/);
  });

  test('shows a one-line embeddings status in the rail that opens the full detail', async ({
    page,
  }) => {
    await page.goto('/');

    const statusRow = page.getByRole('button', { name: /Ver el detalle$/ });
    await expect(statusRow).toContainText('Coincide con el corpus');

    await statusRow.click();
    await expect(page.getByRole('heading', { name: 'Estado de los embeddings' })).toBeVisible();
    await expect(page.getByText('embedding-local')).toBeVisible();
    await expect(page.getByText('embedding-api')).toBeVisible();
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`at ${viewport.width}px, the embeddings status row reads as a button: chevron, hover fill, full accessible name and no axe violations`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const statusRow = page.getByRole('button', { name: /Coincide con el corpus/ });
      await expect(statusRow).toBeVisible();
      await expect(statusRow).toHaveAccessibleName(
        'Embeddings: Coincide con el corpus. Ver el detalle',
      );
      await expect(statusRow.locator('svg.lucide-chevron-right')).toBeVisible();

      await page.mouse.move(0, 0);
      const transparent = 'rgba(0, 0, 0, 0)';
      await expect(statusRow).toHaveCSS('background-color', transparent);
      await statusRow.hover();
      await expect(statusRow).not.toHaveCSS('background-color', transparent);
      await expect(statusRow).toHaveCSS('cursor', 'pointer');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('at 1440x900, the rail scrolls independently of the page: scrolled to the bottom of a long list, its footer CTA stays visible and the page itself never scrolls', async ({
    page,
  }) => {
    const manySummaries = Array.from({ length: 30 }, (_unused, index) => ({
      id: `doc-${String(index + 1).padStart(2, '0')}`,
      title: `Article number ${index + 1}`,
      authors: ['A. Author'],
    }));
    await page.route('**/api/v1/corpus', async (route) => {
      await route.fulfill({ json: manySummaries });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Comparación de similitud' })).toBeVisible();

    const compareButton = page.getByRole('button', { name: 'Comparar' });
    await expect(compareButton).toBeVisible();

    // The page itself: no vertical scroll at all (the workbench fills the
    // exact viewport height below the top bar and clips its own overflow).
    const pageScrollHeight = await page.evaluate('document.documentElement.scrollHeight');
    expect(pageScrollHeight).toBeLessThanOrEqual(900);

    // Scroll the rail's own list region — not the page — all the way down.
    const lastRow = page.getByRole('checkbox', { name: 'Article number 30' });
    await lastRow.scrollIntoViewIfNeeded();
    await expect(lastRow).toBeVisible();

    // The footer CTA is still pinned in view after that internal scroll —
    // never scrolled out alongside the list, and the page still has not
    // scrolled at all.
    await expect(compareButton).toBeVisible();
    const pageScrollHeightAfter = await page.evaluate('document.documentElement.scrollHeight');
    expect(pageScrollHeightAfter).toBeLessThanOrEqual(900);
    const pageScrollY = await page.evaluate('window.scrollY');
    expect(pageScrollY).toBe(0);
  });

  test('at 390px with a full-size corpus, the page scrolls to reach the last rail row with no page-level horizontal scroll', async ({
    page,
  }) => {
    const manySummaries = Array.from({ length: 30 }, (_unused, index) => ({
      id: `doc-${String(index + 1).padStart(2, '0')}`,
      title: `Article number ${index + 1}`,
      authors: ['A. Author'],
    }));
    await page.route('**/api/v1/corpus', async (route) => {
      await route.fulfill({ json: manySummaries });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    // Below `lg`, before any comparison, the corpus list itself is the
    // screen's own main content (no persistent rail, no "select 2" message).
    await expect(
      page.getByRole('checkbox', { name: 'Article number 1', exact: true }),
    ).toBeVisible();

    const lastRow = page.getByRole('checkbox', { name: 'Article number 30' });
    await lastRow.scrollIntoViewIfNeeded();
    await expect(lastRow).toBeVisible();
    await lastRow.check();
    await expect(lastRow).toBeChecked();

    // Below `lg`, the main-content region has no bounded height of its own
    // (only the `lg:h-full lg:overflow-y-auto` pair applies from `lg` up):
    // the corpus list stacks in normal document flow, so reaching a row
    // this far down the list is necessarily the PAGE scrolling, not an
    // internal scrollbar. `scrollIntoViewIfNeeded` alone doesn't prove
    // that — it scrolls whichever ancestor is scrollable, silently passing
    // even if that ancestor were something other than the page.
    const pageScrollY = await page.evaluate('window.scrollY');
    expect(pageScrollY as number).toBeGreaterThan(0);

    // "No horizontal overflow" is `scrollWidth <= clientWidth`, the same
    // check the dedicated 390px overflow test above uses — a full 30-row
    // corpus must not widen the page just because the list grew taller.
    const overflow = await page.evaluate(
      '(() => { const el = document.documentElement; return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }; })()',
    );
    expect(
      (overflow as { scrollWidth: number; clientWidth: number }).scrollWidth,
    ).toBeLessThanOrEqual((overflow as { scrollWidth: number; clientWidth: number }).clientWidth);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the similarity workbench', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Comparación de similitud' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('below 1024px, before any comparison, the corpus list is the main content with no page-level horizontal overflow and no axe violations at 390px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(
      page.getByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeVisible();
    await expect(page.getByTestId('selection-tray')).toBeVisible();

    // "No horizontal overflow" is `scrollWidth <= clientWidth`, not a pinned
    // literal pixel value — a device pixel ratio, a scrollbar-gutter
    // reservation, or a future content change could shift the exact number
    // without there being any real overflow, and a pinned-to-390 assertion
    // would then fail for a reason unrelated to what this test guards
    // against. A string body (not an arrow function) evaluates in the
    // browser without pulling the `dom` lib into this project's Node-typed
    // e2e tsconfig, the same pattern the WCAG 2.4.11 test above uses.
    const overflow = await page.evaluate(
      '(() => { const el = document.documentElement; return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }; })()',
    );
    expect(
      (overflow as { scrollWidth: number; clientWidth: number }).scrollWidth,
    ).toBeLessThanOrEqual((overflow as { scrollWidth: number; clientWidth: number }).clientWidth);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('below lg (390px), a basic comparison takes exactly three interactions: select, select, compare', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const firstRow = page.getByRole('checkbox', { name: 'A survey of string similarity' });
    const secondRow = page.getByRole('checkbox', { name: 'Embeddings for scientific text' });
    // `toBeVisible()` fails on a zero-size box, not merely on DOM presence —
    // a real regression this specific check would catch.
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();
    const rowBox = await firstRow.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(rowBox!.height).toBeGreaterThan(0);

    // Interaction 1: select the first article.
    await firstRow.check();
    // Interaction 2: select the second article. The corpus list stays the
    // main content — selecting the second article alone never navigates.
    await secondRow.check();
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    const compareButton = page.getByRole('button', { name: 'Comparar doc-01 y doc-02' });
    await expect(compareButton).toBeVisible();
    await expect(compareButton).toBeEnabled();
    // Interaction 3: compare, from the docked selection tray.
    await compareButton.click();

    await expect(page.getByRole('heading', { name: 'doc-01 frente a doc-02' })).toBeVisible();
    await expect(firstRow).toHaveCount(0);
  });

  test('below lg (390px) an article abstract opens as a dialog and closes back to the title', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const title = page.getByRole('button', { name: 'A survey of string similarity' });
    await title.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('This paper surveys classic and embedding-based similarity measures.'),
    ).toBeVisible();
    // Never both at once: the docked/overlay detail region never mounts
    // below `lg`, even while the dialog holds the same content.
    await expect(page.getByTestId('workbench-detail')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Cerrar' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(title).toBeFocused();
  });

  test('an old /corpus/:id link opens that exact article on /similarity, never dropping the id', async ({
    page,
  }) => {
    await page.goto('/corpus/doc-01');

    await expect(page).toHaveURL(/\/similarity$/);
    await expect(page.getByTestId('workbench-detail')).toBeVisible();
    await expect(
      page.getByText('This paper surveys classic and embedding-based similarity measures.'),
    ).toBeVisible();
  });

  test('an unknown /corpus/:id link lands on plain /similarity with no panel open', async ({
    page,
  }) => {
    await page.goto('/corpus/doc-99');

    await expect(page).toHaveURL(/\/similarity$/);
    await expect(page.getByRole('heading', { name: 'Comparación de similitud' })).toBeVisible();
    await expect(page.getByTestId('workbench-detail')).toHaveCount(0);
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
