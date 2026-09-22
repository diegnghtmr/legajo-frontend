import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped payloads (TRD §6.6 `GET /corpus`, `POST /clustering`) — no
 * live backend: `page.route` intercepts every request so this suite runs
 * fully offline, per the task's e2e instructions. 6 documents -> k_ref =
 * min(4, 6-1) = 4, so every fixed cut k ∈ {2,3,4,5} is present.
 */
const CORPUS_SUMMARIES = Array.from({ length: 6 }, (_unused, index) => ({
  id: `doc-0${index + 1}`,
  title: `Article ${index + 1}`,
  authors: ['A. Author'],
}));

function evaluation(cophenetic: number, silhouetteAtKRef: number, dbAtKRef: number | null) {
  return {
    cophenetic,
    meanSilhouette: { '2': 0.15, '3': 0.25, '4': silhouetteAtKRef, '5': 0.35 },
    daviesBouldin: { '2': 0.6, '3': 0.5, '4': dbAtKRef, '5': 0.4 },
  };
}

/**
 * `single` wins cophenetic alone (no tie, TRD §6.5); `complete` has the
 * highest silhouette at k_ref=4, so the two leaders differ and both the
 * "Árbol"/Tree and "Partición"/Partition eyebrows are exercised.
 */
const DEFAULT_CLUSTERING_RESPONSE = [
  {
    linkageId: 'single',
    linkageDisplayName: 'Single',
    rows: [],
    leafOrder: [0, 1, 2, 3, 4, 5],
    evaluation: evaluation(0.95, 0.2, 0.5),
  },
  {
    linkageId: 'complete',
    linkageDisplayName: 'Complete',
    rows: [],
    leafOrder: [0, 1, 2, 3, 4, 5],
    evaluation: evaluation(0.5, 0.9, 0.1),
  },
  {
    linkageId: 'average',
    linkageDisplayName: 'Average',
    rows: [],
    leafOrder: [0, 1, 2, 3, 4, 5],
    evaluation: evaluation(0.4, 0.3, 0.2),
  },
  {
    linkageId: 'ward',
    linkageDisplayName: 'Ward',
    rows: [],
    leafOrder: [0, 1, 2, 3, 4, 5],
    evaluation: evaluation(0.3, 0.1, null),
  },
];

async function mockClusteringApi(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/clustering', async (route) => {
    await route.fulfill({ json: DEFAULT_CLUSTERING_RESPONSE });
  });
}

test.describe('clustering screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockClusteringApi(page);
  });

  test('the default request (tfidf-cosine, all four linkages) shows four linkage metric groups with the cophenetic leader marked', async ({
    page,
  }) => {
    const requestBodies: unknown[] = [];
    await page.route('**/api/v1/clustering', async (route) => {
      requestBodies.push(route.request().postDataJSON());
      await route.fulfill({ json: DEFAULT_CLUSTERING_RESPONSE });
    });

    await page.goto('/clustering');

    await expect(page.getByRole('heading', { name: 'Agrupamiento jerárquico' })).toBeVisible();

    for (const { linkageDisplayName } of DEFAULT_CLUSTERING_RESPONSE) {
      await expect(page.getByRole('heading', { name: linkageDisplayName })).toBeVisible();
    }

    // The cophenetic leader (single) is marked "Árbol"; the differing
    // silhouette-at-k_ref leader (complete) is marked "Partición".
    await expect(page.getByText('Árbol')).toBeVisible();
    await expect(page.getByText('Partición')).toBeVisible();

    // Ward's k_ref Davies-Bouldin is null (TRD §6.5).
    await expect(page.getByText('no definido').first()).toBeVisible();

    // Sample-size caveat states n = |corpus| (6 documents mocked above).
    await expect(page.getByText(/n = 6/)).toBeVisible();

    expect(requestBodies).toEqual([
      { representation: 'tfidf-cosine', linkages: ['single', 'complete', 'average', 'ward'] },
    ]);
  });

  test('switching representation re-requests the clustering endpoint', async ({ page }) => {
    const requestBodies: unknown[] = [];
    await page.route('**/api/v1/clustering', async (route) => {
      requestBodies.push(route.request().postDataJSON());
      await route.fulfill({ json: DEFAULT_CLUSTERING_RESPONSE });
    });

    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    const group = page.getByRole('radiogroup', { name: 'Representación' });
    await group.getByRole('radio', { name: 'embedding-api' }).click();

    await expect
      .poll(() => requestBodies.at(-1))
      .toEqual({
        representation: 'embedding-api',
        linkages: ['single', 'complete', 'average', 'ward'],
      });
  });

  test('deselecting every linkage shows the reason and no dendrogram-slot panels', async ({
    page,
  }) => {
    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    for (const id of ['single', 'complete', 'average', 'ward']) {
      await page.getByRole('button', { name: id, exact: true }).click();
    }

    await expect(page.getByText('Selecciona al menos un enlace para agrupar.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Single' })).toHaveCount(0);
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the clustering screen', async ({
    page,
  }) => {
    await page.goto('/clustering');

    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
