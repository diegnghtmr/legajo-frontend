import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped payloads (`GET /corpus`, `GET /similarity/algorithms`,
 * `POST /similarity/compare`) — no live backend: `page.route` intercepts every
 * request so this suite runs fully offline.
 */
const CORPUS_SUMMARIES = [
  { id: 'doc-01', title: 'A survey of string similarity', authors: ['A. One', 'B. Two'] },
  { id: 'doc-02', title: 'Embeddings for scientific text', authors: ['C. Three'] },
];

const ALGORITHM_CATALOGUE = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'needleman-wunsch', displayName: 'Needleman–Wunsch', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
  { id: 'tfidf-cosine', displayName: 'TF-IDF cosine', kind: 'CLASSIC' },
  { id: 'embedding-local', displayName: 'Local embedding', kind: 'AI' },
  { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' },
];

const COMPARE_RESULTS = [
  {
    algorithmId: 'levenshtein',
    result: {
      normalizedScore: 0.72,
      rawValue: 84,
      computedNanos: 15234,
      cached: false,
      degenerate: false,
    },
  },
  {
    algorithmId: 'needleman-wunsch',
    result: {
      normalizedScore: 0.68,
      rawValue: 51,
      computedNanos: 18211,
      cached: false,
      degenerate: false,
    },
  },
  {
    algorithmId: 'jaccard',
    result: {
      normalizedScore: 0.41,
      rawValue: 0.41,
      computedNanos: 9021,
      cached: false,
      degenerate: false,
    },
  },
  {
    // Degenerate TF-IDF case: one empty preprocessed token stream,
    // rawValue is null and degenerate is true.
    algorithmId: 'tfidf-cosine',
    result: {
      normalizedScore: 0,
      rawValue: null,
      computedNanos: 7002,
      cached: false,
      degenerate: true,
    },
  },
  {
    algorithmId: 'embedding-local',
    result: {
      normalizedScore: 0.83,
      rawValue: 0.83,
      computedNanos: 512044,
      cached: false,
      degenerate: false,
    },
  },
  {
    // Served from cache (the `cached` marker).
    algorithmId: 'embedding-api',
    result: {
      normalizedScore: 0.79,
      rawValue: 0.79,
      computedNanos: 998,
      cached: true,
      degenerate: false,
    },
  },
];

async function mockSimilarityApi(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/similarity/algorithms', async (route) => {
    await route.fulfill({ json: ALGORITHM_CATALOGUE });
  });
  await page.route('**/api/v1/similarity/compare', async (route) => {
    await route.fulfill({ json: COMPARE_RESULTS });
  });
}

test.describe('similarity compare screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockSimilarityApi(page);
  });

  test('selecting two articles and comparing shows all six results with cached and degenerate markers', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();

    const compareButton = page.getByRole('button', { name: 'Comparar doc-01 y doc-02' });
    await expect(compareButton).toBeEnabled();
    await compareButton.click();

    await expect(page.getByRole('heading', { name: 'doc-01 frente a doc-02' })).toBeVisible();

    const rows = page.getByRole('row');
    // Header row + six results.
    await expect(rows).toHaveCount(7);

    for (const { algorithmId } of COMPARE_RESULTS) {
      // Scoped to the row: the family filter above the table has its own
      // same-named toggle button for every algorithm id.
      const row = page.getByRole('row', { name: algorithmId });
      await expect(row.getByRole('button', { name: algorithmId, exact: true })).toBeVisible();
    }

    const degenerateRow = page.getByRole('row', { name: /tfidf-cosine/ });
    await expect(degenerateRow.getByText('—')).toBeVisible();
    await expect(degenerateRow.getByText('Sí')).toBeVisible();

    const cachedRow = page.getByRole('row', { name: /embedding-api/ });
    await expect(cachedRow.getByText('en caché')).toBeVisible();

    const nonCachedRow = page.getByRole('row', { name: /^levenshtein/ });
    await expect(nonCachedRow.getByText('en caché')).toHaveCount(0);
  });

  test('at lg and above, activating the CTA once the pair is already shown moves focus onto the results instead of navigating anywhere', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();

    const compareButton = page.getByRole('button', { name: 'Comparar doc-01 y doc-02' });
    await expect(page.getByRole('heading', { name: 'doc-01 frente a doc-02' })).toBeVisible();
    await expect(page).toHaveURL(/\/similarity$/);

    // The keyboard/assistive-technology path: focusing the button, then
    // Enter — the same activation a real keyboard-only visitor uses,
    // never a mouse click.
    await compareButton.focus();
    await page.keyboard.press('Enter');

    // Never navigates away: the pair was already showing at this width.
    await expect(page).toHaveURL(/\/similarity$/);
    await expect(page.getByTestId('similarity-results-region')).toBeFocused();
  });

  for (const width of [1440, 1024]) {
    test(`at ${width}px, the cached marker stays on one line in the time column, with no page-level horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
      await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
      await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

      const cachedRow = page.getByRole('row', { name: /embedding-api/ });
      const cachedMarker = cachedRow.getByText('en caché');
      await expect(cachedMarker).toBeVisible();

      // A wrapped pill badge turns roughly as tall as it is wide (or
      // taller); this short label's own single-line box is always
      // noticeably wider than it is tall.
      const box = await cachedMarker.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(box!.height);

      const overflow = await page.evaluate(
        '(() => { const el = document.documentElement; return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }; })()',
      );
      expect(
        (overflow as { scrollWidth: number; clientWidth: number }).scrollWidth,
      ).toBeLessThanOrEqual((overflow as { scrollWidth: number; clientWidth: number }).clientWidth);
    });
  }

  test("opens a row's trace from a click on a cell other than the algorithm one", async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    await expect(page.getByRole('row')).toHaveCount(7);

    const row = page.getByRole('row', { name: /^levenshtein/ });
    // The time column, the fourth of the row's own `cell`s (family, score,
    // raw, time, degenerate) — nowhere near the algorithm button — proves
    // the row itself is the trace trigger, not only the box the button
    // visually sits in.
    await row.getByRole('cell').nth(3).click();

    await expect(page).toHaveURL(/\/similarity\/levenshtein\/trace/);
    await expect(row).toHaveAttribute('aria-current', 'true');
  });

  test("opens a row's trace from the keyboard alone (Tab to its own button, then Enter)", async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    await expect(page.getByRole('row')).toHaveCount(7);

    // Scoped to the row: the family filter above the table has its own
    // same-named toggle button for every algorithm id.
    const row = page.getByRole('row', { name: /^levenshtein/ });
    const rowButton = row.getByRole('button', { name: 'levenshtein', exact: true });
    await rowButton.focus();
    await expect(rowButton).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/similarity\/levenshtein\/trace/);
    await expect(row).toHaveAttribute('aria-current', 'true');
  });

  test('the score strip places every result on one axis and a dot opens that row trace', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();
    await expect(page.getByRole('row')).toHaveCount(7);

    const strip = page.getByTestId('score-strip');
    await expect(strip).toHaveAttribute('aria-hidden', 'true');
    await expect(strip.locator('[title]')).toHaveCount(COMPARE_RESULTS.length);

    const dot = strip.getByTitle('embedding-local: 0.830');
    const box = await dot.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
    // Never a tab stop: the table rows are the keyboard path.
    await expect(dot).toHaveAttribute('tabindex', '-1');

    await dot.click();

    await expect(page).toHaveURL(/\/similarity\/embedding-local\/trace/);
    await expect(page.getByRole('row', { name: /^embedding-local/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(strip.getByTitle('embedding-local: 0.830').locator('[data-dot]')).toHaveAttribute(
      'data-open',
      'true',
    );
  });

  test('at 390px the score strip is visual only and the page does not scroll sideways', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    const strip = page.getByTestId('score-strip');
    await expect(strip).toBeVisible();
    await expect(strip.locator('button')).toHaveCount(0);
    const overflow = await page.evaluate<number>(
      '(() => { const el = document.documentElement; return el.scrollWidth - el.clientWidth; })()',
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the compare results', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    await expect(page.getByRole('row')).toHaveCount(7);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('has no empty-table-header violation on the docked DP trace panel’s own matrix', async ({
    page,
  }) => {
    // `empty-table-header` is a best-practice rule, not one of the strict
    // WCAG tags the compare-results axe pass above filters by — this one
    // targets it directly, reproducing the reported violation on the DP
    // matrix's sticky top-left corner `<th>`.
    await page.route('**/api/v1/similarity/levenshtein/trace**', async (route) => {
      await route.fulfill({ json: DP_TRACE });
    });
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    const row = page.getByRole('row', { name: /^levenshtein/ });
    await row.getByRole('button', { name: 'levenshtein', exact: true }).click();

    await expect(page.getByTestId('workbench-detail')).toBeVisible();
    await expect(
      page.getByTestId('workbench-detail').getByRole('heading', { name: 'Levenshtein distance' }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).withRules(['empty-table-header']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('below lg (390px), the results render as a list of row buttons, and a row opens its trace as a full-height sheet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    // A list, never a table, below lg.
    await expect(page.getByRole('table')).toHaveCount(0);
    const list = page.getByRole('list', { name: 'Resultados de similitud por algoritmo' });
    await expect(list).toBeVisible();

    for (const { algorithmId } of COMPARE_RESULTS) {
      await expect(list.getByRole('button', { name: algorithmId, exact: true })).toBeVisible();
    }

    const cachedRow = list.getByRole('button', { name: 'embedding-api', exact: true });
    await expect(cachedRow).toContainText('en caché');

    const row = list.getByRole('button', { name: 'levenshtein', exact: true });
    const rowBox = await row.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(rowBox!.height).toBeGreaterThanOrEqual(44);

    await row.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Levenshtein distance' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Cerrar traza' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
  });
});

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

const DP_TRACE = {
  algorithmId: 'levenshtein',
  rowLabels: ['k', 'i', 't'],
  columnLabels: ['s', 'i', 't'],
  matrix: [
    [0, 1, 2, 3],
    [1, 1, 2, 3],
    [2, 2, 1, 2],
    [3, 3, 2, 1],
  ],
  optimalPath: [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
    { row: 3, col: 3 },
  ],
  operations: [
    { from: { row: 0, col: 0 }, to: { row: 1, col: 1 }, operation: 'SUBSTITUTION' },
    { from: { row: 1, col: 1 }, to: { row: 2, col: 2 }, operation: 'MATCH' },
    { from: { row: 2, col: 2 }, to: { row: 3, col: 3 }, operation: 'MATCH' },
  ],
};

/** A cold deep link straight into the trace route resolves its own
 * comparison and trace from the URL alone, but the rail/tray only ever
 * read the shared selection store — nothing else in the tree ever tells it
 * about a pair the URL itself already named. */
test.describe('a cold deep link to the trace route with an empty rail selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockSimilarityApi(page);
    await page.route('**/api/v1/embeddings/status', async (route) => {
      await route.fulfill({ json: EMBEDDINGS_STATUS });
    });
    await page.route('**/api/v1/similarity/levenshtein/trace**', async (route) => {
      await route.fulfill({ json: DP_TRACE });
    });
  });

  test('at 1440x900, seeds the rail: both checkboxes checked and the confirmed CTA enabled', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

    await expect(page.getByTestId('workbench-detail')).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: 'Embeddings for scientific text' }),
    ).toBeChecked();
    await expect(page.getByRole('button', { name: 'Comparar doc-01 y doc-02' })).toBeEnabled();
  });

  test('at 390x844, seeds the tray, and closing the trace shows the results list instead of reverting to the corpus list', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The open trace dialog marks the rest of the page aria-hidden while it
    // stays open — `includeHidden: true` still finds the tray's own CTA
    // underneath it.
    await expect(
      page.getByRole('button', { name: 'Comparar doc-01 y doc-02', includeHidden: true }),
    ).toBeEnabled();

    await dialog.getByRole('button', { name: 'Cerrar traza' }).click();

    await expect(
      page.getByRole('list', { name: 'Resultados de similitud por algoritmo' }),
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'A survey of string similarity' })).toHaveCount(
      0,
    );
  });

  test('a cold full-screen trace URL (/trace/full) also seeds the rail, not only the docked trace route', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/similarity/levenshtein/trace/full?documentIdA=doc-01&documentIdB=doc-02');

    await expect(page.getByRole('heading', { name: 'Levenshtein distance' })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: 'Embeddings for scientific text' }),
    ).toBeChecked();
    await expect(page.getByRole('button', { name: 'Comparar doc-01 y doc-02' })).toBeEnabled();
  });

  test('at 1440x900, unchecking a rail article leaves the full-screen trace for plain /similarity instead of keeping the stale pair on screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/similarity/levenshtein/trace/full?documentIdA=doc-01&documentIdB=doc-02');

    await expect(page.getByRole('heading', { name: 'Levenshtein distance' })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeChecked();

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).uncheck();

    await expect(page).toHaveURL('/similarity');
    await expect(page.getByRole('heading', { name: 'Levenshtein distance' })).toHaveCount(0);
  });

  test('at 1440x900, pressing Limpiar leaves the full-screen trace for plain /similarity instead of keeping the stale pair on screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/similarity/levenshtein/trace/full?documentIdA=doc-01&documentIdB=doc-02');

    await expect(page.getByRole('heading', { name: 'Levenshtein distance' })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'A survey of string similarity' }),
    ).toBeChecked();

    await page.getByRole('button', { name: 'Limpiar' }).click();

    await expect(page).toHaveURL('/similarity');
    await expect(page.getByRole('heading', { name: 'Levenshtein distance' })).toHaveCount(0);
  });
});

/**
 * A synthetic n×n matrix large enough that auto-scrolling to its final
 * (bottom-right) path cell moves the viewport by more than a trivial
 * amount — same fixture shape as the standalone full-screen suite's own.
 * `rowLabels`/`columnLabels` carry `size - 1` tokens each, one shorter
 * than the matrix itself (the backend's own contract: neither array
 * carries an entry for the empty-prefix border at index 0).
 */
function buildLargeDpTrace(size: number) {
  const rowLabels = Array.from({ length: size - 1 }, () => 'a');
  const columnLabels = Array.from({ length: size - 1 }, () => 'b');
  const matrix = Array.from({ length: size }, (_unused, row) =>
    Array.from({ length: size }, (_unused2, col) => row + col),
  );
  const optimalPath = Array.from({ length: size }, (_unused, index) => ({
    row: index,
    col: index,
  }));
  const operations = optimalPath.slice(1).map((cell, index) => ({
    from: optimalPath[index],
    to: cell,
    operation: 'MATCH',
  }));
  return { algorithmId: 'levenshtein', rowLabels, columnLabels, matrix, optimalPath, operations };
}

test.describe('the docked trace panel with a large DP matrix', () => {
  test.beforeEach(async ({ page }) => {
    await mockSimilarityApi(page);
    await page.route('**/api/v1/similarity/levenshtein/trace**', async (route) => {
      await route.fulfill({ json: buildLargeDpTrace(60) });
    });
  });

  test('scrolls only the matrix viewport, keeping the panel header and the results in place', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

    const panel = page.getByTestId('workbench-detail');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Levenshtein distance' })).toBeVisible();
    // The results table stays visible in the center region — a
    // `scrollIntoView` on the matrix's final cell used to scroll every
    // scrollable ancestor, including the panel and, at this width, the
    // page itself.
    await expect(page.getByRole('heading', { name: 'doc-01 frente a doc-02' })).toBeVisible();

    const finalPathCell = page.locator('[data-optimal-path="true"]').last();
    await expect(finalPathCell).toBeInViewport();
  });
});
