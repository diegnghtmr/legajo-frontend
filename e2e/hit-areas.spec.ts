import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Every interactive control's real tap target at the 390px reference phone
 * width must be at least 44×44px, whether that comes from the control's
 * own visible box or an invisible `pointer-coarse:before:inset-*`
 * pseudo-element extending it (`Button`'s `mono` variant, `Checkbox`).
 *
 * `hasTouch`/`isMobile` (not just a narrow `setViewportSize`, which every
 * other 390px spec in this repo uses for layout-only assertions) makes
 * Chromium itself report `(pointer: coarse)`, the exact media feature the
 * `pointer-coarse:` utilities key off — without it, those utilities never
 * activate and every measurement below would silently read the smaller
 * desktop-density box instead of the real touch target.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

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

function compareResultFor(algorithmId: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    algorithmId,
    result: {
      normalizedScore: 0.72,
      rawValue: 84,
      computedNanos: 15234,
      cached: false,
      degenerate: false,
      ...overrides,
    },
  };
}

const COMPARE_RESULTS = ALGORITHM_CATALOGUE.map(({ id }) => compareResultFor(id));

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

const CORPUS_DOCUMENT = {
  id: 'doc-01',
  title: 'A survey of string similarity',
  authors: ['A. One', 'B. Two'],
  abstract: 'This paper surveys classic and embedding-based similarity measures.',
};

async function mockCorpusAndSimilarity(page: Page) {
  await page.route('**/api/v1/corpus', async (route) => {
    await route.fulfill({ json: CORPUS_SUMMARIES });
  });
  await page.route('**/api/v1/corpus/doc-01', async (route) => {
    await route.fulfill({ json: CORPUS_DOCUMENT });
  });
  await page.route('**/api/v1/embeddings/status', async (route) => {
    await route.fulfill({ json: EMBEDDINGS_STATUS });
  });
  await page.route('**/api/v1/similarity/algorithms', async (route) => {
    await route.fulfill({ json: ALGORITHM_CATALOGUE });
  });
  await page.route('**/api/v1/similarity/compare', async (route) => {
    await route.fulfill({ json: COMPARE_RESULTS });
  });
  await page.route('**/api/v1/similarity/trace/**', async (route) => {
    await route.fulfill({
      json: {
        algorithmId: 'jaccard',
        setA: ['a', 'b'],
        setB: ['b', 'c'],
        intersectionSize: 1,
        unionSize: 3,
        coefficient: 1 / 3,
      },
    });
  });
}

/** The handful of DOM members this file's browser-side callback needs —
 * spelled out locally, rather than adding the `dom` lib (which this
 * project's Node-typed e2e tsconfig deliberately omits, per
 * `tsconfig.node.json`), so the callback still typechecks as a real
 * function (passed as-is to `locator.evaluate`, never a bare string a
 * runtime has to parse back into one) without `any` anywhere. */
interface HitSizeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
interface HitSizeElement {
  getBoundingClientRect(): HitSizeRect;
  contains(other: unknown): boolean;
}
interface HitSizeDocument {
  elementFromPoint(x: number, y: number): HitSizeElement | null;
}
interface HitSizeComputedStyle {
  pointerEvents: string;
}
interface HitSizeWindow {
  getComputedStyle(element: HitSizeElement): HitSizeComputedStyle;
}

/**
 * Whether a real tap anywhere in a 44×44 CSS-pixel box centered on the
 * control's own visual center would actually land on that control (or one
 * of its descendants) — sampled at the box's four edge midpoints (top,
 * bottom, left, right), each one `document.elementFromPoint` away from the
 * center. This asks the browser's own hit-test, the same one a real tap
 * resolves through, rather than re-deriving the geometry from the
 * control's `getBoundingClientRect()` plus a `::before`/`::after` pseudo's
 * own CSS `inset`: that arithmetic silently assumes the pseudo's
 * offsets resolve against the control's *own* box, which only holds when
 * the control itself is the pseudo's containing block (`position:
 * relative` on that same element) — an absolutely positioned pseudo's
 * `top`/`right`/`bottom`/`left` are resolved by the browser against
 * whichever ancestor actually establishes that containing block, and even
 * when it is the control's own box, an intervening `overflow: hidden`
 * ancestor can still clip the extension down before it ever reaches the
 * viewport. A CSS-only replica of that geometry cannot see either case;
 * asking the browser to actually resolve a tap at each sampled point
 * always reflects both. Conservative in one direction: a control passes
 * only when every sampled edge resolves to it, so a real gap this
 * measure could still under-count as a false failure (an exotic,
 * non-rectangular hit area off-center from the control) never passes it,
 * but it can never call a genuinely un-tappable point tappable.
 *
 * A `pointer-events: none` control (this repo's own `disabled:` state) is
 * the one deliberate exception: nothing, anywhere, can ever resolve a tap
 * to it while it stays that way — a real hit-test would always "fail" it
 * for a reason that has nothing to do with its own reserved size, the
 * actual thing a disabled control's own touch-target check cares about (so
 * re-enabling it later never comes with a surprise reflow). That one case
 * falls back to the plain bounding-box measurement instead.
 */
async function isFullyTappable44(locator: Locator): Promise<boolean> {
  return locator.evaluate((el: HitSizeElement) => {
    const rect = el.getBoundingClientRect();
    const win = (globalThis as unknown as { window: HitSizeWindow }).window;
    if (win.getComputedStyle(el).pointerEvents === 'none') {
      return rect.right - rect.left >= 44 && rect.bottom - rect.top >= 44;
    }
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;
    // 1px inside the true 44px edge on every side, not exactly on it: two
    // adjacent controls can sit only a hairline apart (`ToggleGroup`'s own
    // `gap-0.5`), and a sample placed exactly on a shared boundary can land
    // on whichever side sub-pixel rounding resolves it to, independent of
    // either control's own real tappable size. This is still a strictly
    // stronger requirement than the historical geometry-only math ever
    // enforced (a genuinely undersized or clipped target, like this file's
    // own adversarial fixture below, still fails it).
    const half = 21; // 44px / 2, minus that 1px margin
    const samplePoints: ReadonlyArray<[number, number]> = [
      [centerX, centerY - half], // top edge midpoint
      [centerX, centerY + half], // bottom edge midpoint
      [centerX - half, centerY], // left edge midpoint
      [centerX + half, centerY], // right edge midpoint
    ];
    const doc = (globalThis as unknown as { document: HitSizeDocument }).document;
    return samplePoints.every(([x, y]) => {
      const hit = doc.elementFromPoint(x, y);
      return hit !== null && (hit === el || el.contains(hit));
    });
  });
}

/** Asserts every element the locator matches — not just the first — since
 * `getByRole` and similar queries often resolve to several controls at
 * once (every algo button, every rail row's checkbox). */
async function expectEachAtLeast44(locator: Locator, label: string) {
  // Waits for the first match to actually appear before counting — a bare
  // `.count()` runs immediately and reads 0 against content that just
  // hasn't finished loading yet, not a real absence.
  await locator.first().waitFor();
  const count = await locator.count();
  expect(count, `expected at least one match for ${label}`).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const one = locator.nth(index);
    // A real tap targets whatever is actually reachable, scrolling it as
    // far into view as the page allows first — `block: 'end'` (not
    // Playwright's own `scrollIntoViewIfNeeded`, which is a no-op here: its
    // own "in view" check only looks at the viewport bounds, blind to a
    // `position: fixed` sibling — such as this app's own docked selection
    // tray — sitting on top of an element that is technically already
    // inside those bounds). A control that clears a sticky footer once
    // scrolled as far as the page's own scroll range allows is not the same
    // defect as one nothing can ever scroll clear of.
    const accessibleName = (await one.getAttribute('aria-label')) ?? (await one.textContent());
    let tappable = await isFullyTappable44(one);
    if (!tappable) {
      // A real tap targets whatever is actually reachable, not only its
      // arbitrary pre-scroll position — a fixed, on-top sibling (this
      // app's own docked selection tray, below `lg`) can cover an element
      // the page's own scroll bounds could otherwise clear, and neither
      // `getBoundingClientRect()` (purely geometric) nor Playwright's own
      // `scrollIntoViewIfNeeded()` (which only checks whether the target's
      // own rect already sits inside the viewport, blind to anything drawn
      // on top of it — a no-op here) ever accounts for that. Retried once,
      // scrolled as far as the page's own scroll range goes, before
      // reporting a real failure; the scroll position is restored
      // afterwards so it never carries over to the next candidate.
      await one.page().evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
      tappable = await isFullyTappable44(one);
      await one.page().evaluate('window.scrollTo(0, 0)');
    }
    expect(
      tappable,
      `${label} (${accessibleName?.trim()}) does not resolve a real tap everywhere in its own centered 44x44 box, even scrolled as far as the page allows`,
    ).toBe(true);
  }
}

test.describe('44x44 touch targets at 390px', () => {
  test('the selection tray summary, its CTA and the corpus-list sheet controls', async ({
    page,
  }) => {
    await mockCorpusAndSimilarity(page);
    await page.goto('/');
    const traySummary = page.getByRole('button', { name: 'Abrir la lista del corpus' });
    await expect(traySummary).toBeVisible();

    await expectEachAtLeast44(traySummary, 'tray summary');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await expectEachAtLeast44(
      page.getByRole('button', { name: 'Comparar' }),
      'tray CTA (disabled)',
    );

    await page.getByRole('button', { name: 'Abrir la lista del corpus' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();

    await expectEachAtLeast44(sheet.getByRole('checkbox'), 'corpus-list sheet checkbox');
    await expectEachAtLeast44(
      sheet.getByRole('button', { name: 'Limpiar' }),
      'corpus-list sheet Limpiar',
    );
    await expectEachAtLeast44(
      sheet.getByRole('button', { name: /^Embeddings:/ }),
      'corpus-list sheet embeddings status row',
    );
  });

  test('an article abstract sheet close button', async ({ page }) => {
    await mockCorpusAndSimilarity(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'A survey of string similarity' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expectEachAtLeast44(
      dialog.getByRole('button', { name: 'Cerrar' }),
      'abstract sheet close',
    );
  });

  test('the family Segmented, the algo text buttons and each results-list row', async ({
    page,
  }) => {
    await mockCorpusAndSimilarity(page);
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'A survey of string similarity' }).check();
    await page.getByRole('checkbox', { name: 'Embeddings for scientific text' }).check();
    await page.getByRole('button', { name: 'Comparar doc-01 y doc-02' }).click();

    await expectEachAtLeast44(page.getByRole('radio'), 'family Segmented option');

    const list = page.getByRole('list', { name: 'Resultados de similitud por algoritmo' });
    await expect(list).toBeVisible();
    for (const { id } of ALGORITHM_CATALOGUE) {
      await expectEachAtLeast44(
        page.getByRole('button', { name: id, exact: true }),
        `algo text button / results row (${id})`,
      );
    }

    const row = list.getByRole('button', { name: 'jaccard', exact: true });
    await row.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectEachAtLeast44(
      dialog.getByRole('button', { name: 'Cerrar traza' }),
      'trace sheet close',
    );
  });

  test('the top bar menu button and the language switch', async ({ page }) => {
    await mockCorpusAndSimilarity(page);
    await page.goto('/');

    await expectEachAtLeast44(
      page.getByRole('button', { name: 'Abrir navegación' }),
      'nav menu toggle',
    );
    await expectEachAtLeast44(
      page.getByRole('button', { name: /^(Español|English)$/ }),
      'language switch',
    );
  });

  test('the clustering control bar has no controls under 44px', async ({ page }) => {
    // Same golden n=6 linkage matrix shape `clustering.spec.ts` mocks —
    // `Dendrogram` rejects a malformed/empty `rows` shape, so a real
    // matrix is required for the screen to render at all.
    const documentIds = Array.from({ length: 6 }, (_unused, index) => `doc-0${index + 1}`);
    const goldenRows = [
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
    const clusteringResponse = [
      { linkageId: 'single', linkageDisplayName: 'Single' },
      { linkageId: 'complete', linkageDisplayName: 'Complete' },
      { linkageId: 'average', linkageDisplayName: 'Average' },
      { linkageId: 'ward', linkageDisplayName: 'Ward' },
    ].map(({ linkageId, linkageDisplayName }) => ({
      linkageId,
      linkageDisplayName,
      rows: goldenRows,
      leafOrder: [0, 1, 2, 3, 4, 5],
      documentIds,
      evaluation: evaluation(0.5),
    }));

    await page.route('**/api/v1/corpus', async (route) => {
      await route.fulfill({
        json: documentIds.map((id, index) => ({
          id,
          title: `Article ${index + 1}`,
          authors: ['A. Author'],
        })),
      });
    });
    await page.route('**/api/v1/clustering', async (route) => {
      await route.fulfill({ json: clusteringResponse });
    });

    await page.goto('/clustering');
    await expect(page.getByRole('heading', { name: 'Single' })).toBeVisible();

    await expectEachAtLeast44(
      page.getByRole('radiogroup', { name: 'Representación' }).getByRole('radio'),
      'clustering representation option',
    );
    for (const linkageId of ['single', 'complete', 'average', 'ward']) {
      await expectEachAtLeast44(
        page.getByRole('button', { name: linkageId, exact: true }),
        `clustering linkage button (${linkageId})`,
      );
    }
    await expectEachAtLeast44(
      page.getByRole('radiogroup', { name: 'Enlace a cortar' }).getByRole('radio'),
      'clustering cut-linkage option',
    );
    await expectEachAtLeast44(
      page.getByRole('button', { name: 'Aplicar corte' }),
      'clustering apply-cut button',
    );
  });

  test('the benchmarks scale Segmented and legend items have no controls under 44px', async ({
    page,
  }) => {
    // Same shape `benchmarks.spec.ts` mocks — every family the page reads
    // must be present, or its own chart-group derivation throws.
    function result(overrides: Record<string, unknown>) {
      return {
        benchmark: 'x',
        family: 'levenshtein',
        parameter: 'length',
        size: 50,
        score: 1,
        error: 0,
        unit: 'us/op',
        ...overrides,
      };
    }
    const families = [
      'levenshtein',
      'needleman-wunsch',
      'jaccard',
      'tfidf-cosine',
      'hac-single',
      'hac-complete',
      'hac-average',
      'hac-ward',
      'mean-silhouette',
      'davies-bouldin',
    ];
    const benchmarkReport = {
      harness: {
        cpuModel: 'test-cpu',
        logicalCores: 8,
        totalRamBytes: 16_000_000_000,
        jdk: 'Eclipse Adoptium 25.0.4',
        os: 'Linux (test)',
        measuredAt: '2026-09-23T00:00:00Z',
      },
      results: [
        ...families.flatMap((family) => [
          result({
            family,
            parameter:
              family.startsWith('hac') ||
              family.includes('silhouette') ||
              family.includes('bouldin')
                ? 'n'
                : 'length',
            size: 5,
            score: 1,
          }),
          result({
            family,
            parameter:
              family.startsWith('hac') ||
              family.includes('silhouette') ||
              family.includes('bouldin')
                ? 'n'
                : 'length',
            size: 80,
            score: 100,
          }),
        ]),
        result({
          family: 'embedding-dot-product',
          parameter: 'dimension',
          size: 384,
          score: 195,
          unit: 'ns/op',
        }),
        result({
          family: 'embedding-dot-product',
          parameter: 'dimension',
          size: 1536,
          score: 843,
          unit: 'ns/op',
        }),
        result({
          family: 'embedding-euclidean-sum-squared',
          parameter: 'dimension',
          size: 384,
          score: 210,
          unit: 'ns/op',
        }),
        result({
          family: 'embedding-euclidean-sum-squared',
          parameter: 'dimension',
          size: 1536,
          score: 867,
          unit: 'ns/op',
        }),
        result({
          family: 'slo-classic-levenshtein',
          parameter: 'n',
          size: 20,
          score: 11.6,
          unit: 'ms/op',
        }),
        result({
          family: 'slo-classic-needleman-wunsch',
          parameter: 'n',
          size: 20,
          score: 11.7,
          unit: 'ms/op',
        }),
        result({
          family: 'slo-classic-jaccard',
          parameter: 'n',
          size: 20,
          score: 7.1,
          unit: 'ms/op',
        }),
        result({
          family: 'slo-classic-tfidf-cosine',
          parameter: 'n',
          size: 20,
          score: 7.2,
          unit: 'ms/op',
        }),
        result({ family: 'slo-clustering', parameter: 'n', size: 20, score: 0.017, unit: 'ms/op' }),
      ],
      slopes: families
        .concat(['embedding-dot-product', 'embedding-euclidean-sum-squared'])
        .map((family) => ({ family, points: 2, empiricalSlope: 2, theoreticalExponent: 2 })),
    };

    await page.route('**/api/v1/benchmarks', async (route) => {
      await route.fulfill({ json: benchmarkReport });
    });
    await page.goto('/benchmarks');
    await expect(
      page.getByRole('heading', { name: 'Benchmarks de rendimiento (JMH)' }),
    ).toBeVisible();

    await expectEachAtLeast44(
      page.getByRole('radiogroup', { name: 'Escala' }).getByRole('radio'),
      'benchmarks scale option',
    );
    // Mid-page, so the shared tap probe (top and bottom scroll only) cannot
    // reach it: measure the box the coarse-pointer rule gives each item.
    const legendItems = page
      .getByRole('list', { name: 'Leyenda de series' })
      .first()
      .getByRole('button');
    for (let index = 0; index < (await legendItems.count()); index += 1) {
      const box = await legendItems.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('rejects a hit-area extension an overflow:hidden ancestor clips below 44x44, even though its own inset math alone would satisfy 44px', async ({
    page,
  }) => {
    // A minimal, self-contained fixture instead of a real screen: a 16px
    // button, `position: relative` (so its own `pointer-coarse:before:`
    // pseudo's `-14px` inset resolves against its own box, exactly like
    // `Checkbox`/`Button` `mono` above), inset -14px on every side would
    // reach the textbook 44x44px box — but a 40x40px `overflow: hidden`
    // wrapper clips that extension down to 40x40px before it ever reaches
    // the viewport. A geometry-only replica of the inset math never sees
    // the clip and reports exactly 44px; only a real hit-test at the
    // 44x44 box's own edges (2px beyond the clip on every side) can catch
    // it.
    await page.setContent(`<!doctype html>
      <html>
        <head>
          <style>
            .clip {
              width: 40px;
              height: 40px;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            #target {
              position: relative;
              width: 16px;
              height: 16px;
              padding: 0;
              margin: 0;
              border: none;
            }
            #target::before {
              content: '';
              position: absolute;
              inset: -14px;
            }
          </style>
        </head>
        <body>
          <div class="clip">
            <button id="target" aria-label="Clipped target">t</button>
          </div>
        </body>
      </html>`);

    await expect(
      expectEachAtLeast44(page.getByRole('button', { name: 'Clipped target' }), 'clipped target'),
    ).rejects.toThrow();
  });
});
