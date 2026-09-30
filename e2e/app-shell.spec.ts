import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped payloads (`GET /corpus`, `POST /clustering`) — no live
 * backend: `page.route` intercepts every request, same offline pattern
 * every other spec in this suite uses. The clustering screen only needs a
 * real, non-empty dendrogram to render at all (`Dendrogram` rejects a
 * malformed/empty `rows` shape), never anything this suite itself reads.
 */
const CORPUS_SUMMARIES = [{ id: 'doc-01', title: 'Article one', authors: ['A. Author'] }];

const GOLDEN_ROWS = [
  { idx1: 0, idx2: 1, mergeDistance: 0.1, size: 2 },
  { idx1: 2, idx2: 3, mergeDistance: 0.2, size: 2 },
  { idx1: 4, idx2: 5, mergeDistance: 0.3, size: 2 },
  { idx1: 6, idx2: 7, mergeDistance: 0.4, size: 4 },
  { idx1: 8, idx2: 9, mergeDistance: 0.5, size: 6 },
];

function evaluation(cophenetic: number) {
  return {
    cophenetic,
    meanSilhouette: { '2': 0.15, '3': 0.25, '4': 0.2, '5': 0.35 },
    daviesBouldin: { '2': 0.6, '3': 0.5, '4': 0.5, '5': 0.4 },
  };
}

const CLUSTERING_RESPONSE = [
  { linkageId: 'single', linkageDisplayName: 'Single' },
  { linkageId: 'complete', linkageDisplayName: 'Complete' },
  { linkageId: 'average', linkageDisplayName: 'Average' },
  { linkageId: 'ward', linkageDisplayName: 'Ward' },
].map(({ linkageId, linkageDisplayName }) => ({
  linkageId,
  linkageDisplayName,
  stemming: false,
  rows: GOLDEN_ROWS,
  leafOrder: [0, 1, 2, 3, 4, 5],
  documentIds: Array.from({ length: 6 }, (_unused, index) => `doc-0${index + 1}`),
  evaluation: evaluation(0.5),
}));

async function mockClustering(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/clustering', async (route) => {
    await route.fulfill({ json: CLUSTERING_RESPONSE });
  });
}

test.describe('app shell keyboard navigation across a resize', () => {
  test('rescues focus onto the active nav link when a resize crosses lg while the mobile menu toggle is focused', async ({
    page,
  }) => {
    await mockClustering(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    const toggle = page.getByRole('button', { name: 'Abrir navegación' });
    // Opens the mobile nav, then closes it via Escape — the exact real
    // flow that leaves the toggle button itself focused (never a link),
    // matching this repo's own AppLayout unit test of the same close path.
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();

    // A resize crossing the `lg` breakpoint (1024px): the toggle button
    // itself becomes `lg:hidden`, so a real browser — unlike jsdom — moves
    // focus off it on its own before this app's own code ever runs again.
    await page.setViewportSize({ width: 1440, height: 900 });

    // `toBeFocused()` polls/retries on its own, absorbing the async gap
    // between the resize above and the browser's own matchMedia `change`
    // event, React's re-render and this component's own layout effect —
    // unlike a single, unretried read, which can race all of that and
    // observe a stale, mid-transition focus state.
    await expect(page.getByRole('link', { name: 'Agrupamiento' })).toBeFocused();
    // A string body (not an arrow function) so this evaluates in the
    // browser without pulling the `dom` lib into this project's Node-typed
    // e2e tsconfig (`tsconfig.node.json`), the same convention
    // `clustering.spec.ts` already uses. Read only after the poll above
    // already settled on the final state.
    const bodyFocused = await page.evaluate<boolean>('document.activeElement === document.body');
    expect(bodyFocused).toBe(false);
  });
});

test('the algorithm catalogue is requested once at startup, before any similarity screen opens', async ({
  page,
}) => {
  let catalogueRequests = 0;
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/similarity/algorithms', async (route) => {
    catalogueRequests += 1;
    await route.fulfill({
      json: [{ id: 'levenshtein', displayName: 'Levenshtein', kind: 'CLASSIC' }],
    });
  });

  await page.goto('/');
  await expect.poll(() => catalogueRequests).toBe(1);
});
