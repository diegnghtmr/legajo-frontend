import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contract-shaped trace payloads (`GET /similarity/{algorithmId}/trace`)
 * — no live backend: `page.route` intercepts every request, per the other
 * suites' offline pattern.
 */
const DP_TRACE = {
  algorithmId: 'levenshtein',
  rowLabels: ['', 'k', 'i', 't'],
  columnLabels: ['', 's', 'i', 't'],
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

const JACCARD_TRACE = {
  algorithmId: 'jaccard',
  setA: ['algorithm', 'similarity', 'token'],
  setB: ['similarity', 'token', 'corpus'],
  intersectionSize: 2,
  unionSize: 4,
  intersection: ['similarity', 'token'],
  union: ['algorithm', 'similarity', 'token', 'corpus'],
  coefficient: 0.5,
};

const TFIDF_TRACE = {
  algorithmId: 'tfidf-cosine',
  corpusSize: 20,
  terms: [
    {
      term: 'algorithm',
      frequencyA: 2,
      frequencyB: 1,
      documentFrequency: 5,
      tfA: 0.2,
      tfB: 0.1,
      idf: 1.3862,
      rawWeightA: 0.2772,
      rawWeightB: 0.1386,
      normalizedWeightA: 0.7071,
      normalizedWeightB: 0.7071,
    },
  ],
  dotProduct: 0.5,
  rawNormA: 1,
  rawNormB: 1,
  cosine: 0.5,
  angleDegrees: 60,
};

const EMBEDDING_LOCAL_TRACE = {
  algorithmId: 'embedding-local',
  provider: 'sentence-transformers',
  model: 'all-MiniLM-L6-v2',
  dimension: 384,
  vectorAExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorBExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorA: [],
  vectorB: [],
  preNormL2A: 1,
  preNormL2B: 1,
  dotProduct: 0.9,
  cosine: 0.9,
  angleDegrees: 25,
  normalizedScore: 0.9,
};

const EMBEDDING_API_TRACE = {
  algorithmId: 'embedding-api',
  provider: 'google',
  model: 'gemini-embedding-2-preview',
  dimension: 1536,
  vectorAExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorBExcerpt: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  vectorA: [],
  vectorB: [],
  preNormL2A: 1,
  preNormL2B: 1,
  sumSquaredDiff: 0.2,
  distance: 0.4472,
  normalizedScore: 0.68,
  providerStatus: 'cached',
};

/** Same catalogue shape the other e2e suites use, keyed by algorithm id. */
const ALGORITHM_CATALOGUE = [
  { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' },
  { id: 'needleman-wunsch', displayName: 'Needleman–Wunsch', kind: 'CLASSIC' },
  { id: 'jaccard', displayName: 'Jaccard index', kind: 'CLASSIC' },
  { id: 'tfidf-cosine', displayName: 'TF-IDF cosine', kind: 'CLASSIC' },
  { id: 'embedding-local', displayName: 'Local embedding', kind: 'AI' },
  { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' },
];

async function mockTrace(page: Page, algorithmId: string, trace: unknown) {
  await page.route('**/api/v1/similarity/algorithms', async (route) => {
    await route.fulfill({ json: ALGORITHM_CATALOGUE });
  });
  await page.route(`**/api/v1/similarity/${algorithmId}/trace**`, async (route) => {
    await route.fulfill({ json: trace });
  });
}

test.describe('similarity trace view', () => {
  test('DP trace: renders the complete matrix, marks the optimal path, and downloads the full CSV', async ({
    page,
  }) => {
    await mockTrace(page, 'levenshtein', DP_TRACE);

    await page.goto('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

    await expect(page.getByRole('heading', { name: 'Levenshtein distance' })).toBeVisible();
    await expect(page.getByTestId('dp-trace-family')).toHaveText('Clásico');
    await expect(page.getByTestId('dp-trace-optimal-path')).toHaveText('1');

    // Every cell of the 4x4 matrix is present, never a truncated subset.
    await expect(page.locator('table').first().locator('td')).toHaveCount(16);

    // Exactly the four optimal-path cells are marked.
    await expect(page.locator('[data-optimal-path="true"]')).toHaveCount(4);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /CSV/i }).click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream ?? []) {
      chunks.push(chunk as Buffer);
    }
    const csv = Buffer.concat(chunks).toString('utf-8');
    const lines = csv.trim().split('\r\n');

    // Header row + one row per matrix row; every cell value present.
    expect(lines).toHaveLength(DP_TRACE.matrix.length + 1);
    for (let row = 0; row < DP_TRACE.matrix.length; row += 1) {
      for (const value of DP_TRACE.matrix[row]) {
        expect(lines[row + 1].split(',')).toContain(String(value));
      }
    }
  });

  test('non-DP trace (Jaccard): renders the token sets, sizes, and coefficient', async ({
    page,
  }) => {
    await mockTrace(page, 'jaccard', JACCARD_TRACE);

    await page.goto('/similarity/jaccard/trace?documentIdA=doc-01&documentIdB=doc-02');

    await expect(page.getByRole('heading', { name: 'Jaccard index' })).toBeVisible();
    await expect(page.getByText('0.500000')).toBeVisible();
    await expect(page.getByRole('region', { name: /intersecci/i })).toContainText('similarity');
    await expect(page.getByRole('region', { name: /uni[oó]n/i })).toContainText('corpus');
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the trace view', async ({
    page,
  }) => {
    await mockTrace(page, 'levenshtein', DP_TRACE);

    await page.goto('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');
    await expect(page.getByRole('heading', { name: 'Levenshtein distance' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  // Every non-DP trace panel gets its own axe pass, not only Jaccard: a
  // `role="region"`-inside-`dl` defect
  // was only caught because one of these panels had an axe-detectable
  // structural violation, so the other `dl`-using panels get the same check.
  const AXE_TRACES: ReadonlyArray<{
    algorithmId: string;
    trace: unknown;
    headingName: string;
  }> = [
    { algorithmId: 'jaccard', trace: JACCARD_TRACE, headingName: 'Jaccard index' },
    { algorithmId: 'tfidf-cosine', trace: TFIDF_TRACE, headingName: 'TF-IDF cosine' },
    {
      algorithmId: 'embedding-local',
      trace: EMBEDDING_LOCAL_TRACE,
      headingName: 'Local embedding',
    },
    {
      algorithmId: 'embedding-api',
      trace: EMBEDDING_API_TRACE,
      headingName: 'Live embedding API',
    },
  ];

  for (const { algorithmId, trace, headingName } of AXE_TRACES) {
    test(`has no automatically detectable WCAG 2.1 AA violations on the ${algorithmId} trace view`, async ({
      page,
    }) => {
      await mockTrace(page, algorithmId, trace);

      await page.goto(`/similarity/${algorithmId}/trace?documentIdA=doc-01&documentIdB=doc-02`);
      await expect(page.getByRole('heading', { name: headingName })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
