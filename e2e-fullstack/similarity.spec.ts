import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  AXE_TAGS,
  fetchCorpus,
  fetchSimilarityCompare,
  fetchSimilarityTrace,
  hasSuccessfulResponse,
  titleOf,
  trackBackendResponses,
} from './support/backend.js';

/**
 * Flow A, full stack, no mocks: pick two real documents
 * (d01, d02) resolved from the real backend via `support/backend.ts`'s
 * `fetchCorpus`/`titleOf` (added alongside this suite's harness), run the
 * comparison against the real backend, see all six algorithms with real
 * values cross-checked via `fetchSimilarityCompare`, and open the
 * Needleman–Wunsch trace/DP matrix, cross-checked via `fetchSimilarityTrace`.
 * `no-mocks.guard.spec.ts` enforces there is no `page.route` anywhere in
 * this directory.
 */
const ALGORITHM_IDS = [
  'levenshtein',
  'needleman-wunsch',
  'jaccard',
  'tfidf-cosine',
  'embedding-local',
  'embedding-api',
] as const;

// Smoke fixture (backend `scripts/smoke.sh`): needleman-wunsch(d01, d02)
// = 0.07075471698113207 for the versioned corpus. A tight tolerance still
// tolerates float-formatting/serialization differences without pinning the
// exact digit string.
const EXPECTED_NW_SCORE = 0.0707;
const NW_SCORE_TOLERANCE = 0.001;

test.describe('similarity compare + trace (full stack, Flow A)', () => {
  test('selecting d01/d02 and comparing shows all six algorithms with real values, cross-checked against the backend', async ({
    page,
    request,
  }) => {
    const backendResponses = trackBackendResponses(page);
    const corpus = await fetchCorpus(request);
    const titleA = titleOf(corpus, 'd01');
    const titleB = titleOf(corpus, 'd02');

    await page.goto('/');
    await page.getByRole('checkbox', { name: titleA }).check();
    await page.getByRole('checkbox', { name: titleB }).check();

    const compareButton = page.getByRole('button', { name: 'Comparar d01 y d02' });
    await expect(compareButton).toBeEnabled();
    await compareButton.click();

    await expect(page.getByRole('heading', { name: 'Comparación de similitud' })).toBeVisible();

    // Header row + six real algorithm results.
    await expect(page.getByRole('row')).toHaveCount(7);
    for (const algorithmId of ALGORITHM_IDS) {
      // Scoped to the row: the family filter above the table has its own
      // same-named toggle button for every algorithm id.
      const row = page.getByRole('row', { name: algorithmId });
      await expect(row.getByRole('button', { name: algorithmId, exact: true })).toBeVisible();
    }

    // Cross-check the rendered needleman-wunsch score against the backend's
    // own response for the exact same pair (independent of what the UI
    // renders): the row's ScoreBar exposes the backend's raw float verbatim
    // via `aria-valuenow` (see ScoreBar.tsx), so this compares real numbers
    // on both sides, not a formatted/rounded display string.
    const backendCompare = await fetchSimilarityCompare(request, 'd01', 'd02', [
      'needleman-wunsch',
    ]);
    const backendScore = backendCompare[0]?.result.normalizedScore;
    expect(backendScore).not.toBeUndefined();
    expect(Math.abs((backendScore as number) - EXPECTED_NW_SCORE)).toBeLessThan(NW_SCORE_TOLERANCE);

    const nwRow = page.getByRole('row', { name: /needleman-wunsch/ });
    const nwMeter = nwRow.getByRole('meter');
    const uiValueNow = await nwMeter.getAttribute('aria-valuenow');
    expect(uiValueNow).not.toBeNull();
    expect(Math.abs(Number(uiValueNow) - (backendScore as number))).toBeLessThan(1e-9);

    expect(hasSuccessfulResponse(backendResponses, '/api/v1/similarity/compare')).toBe(true);
  });

  test('opening the needleman-wunsch trace shows a real DP matrix with a drawn optimal path', async ({
    page,
    request,
  }) => {
    const corpus = await fetchCorpus(request);
    const titleA = titleOf(corpus, 'd01');
    const titleB = titleOf(corpus, 'd02');

    await page.goto('/');
    await page.getByRole('checkbox', { name: titleA }).check();
    await page.getByRole('checkbox', { name: titleB }).check();
    await page.getByRole('button', { name: 'Comparar d01 y d02' }).click();
    await expect(page.getByRole('heading', { name: 'Comparación de similitud' })).toBeVisible();

    await page
      .getByRole('row', { name: 'needleman-wunsch' })
      .getByRole('button', { name: 'needleman-wunsch', exact: true })
      .click();
    // The results table stays mounted next to the panel, so the panel's own
    // DP matrix is scoped by its testid rather than a bare `table` locator.
    const panel = page.getByTestId('trace-detail-panel');
    await expect(panel.getByRole('heading', { name: 'Needleman-Wunsch' })).toBeVisible();

    // The real backend computes the trace for the real d01/d02 abstracts
    // (a genuinely larger matrix than the 4x4 mock), so the page's own
    // `role="status"` loading indicator can still be showing right after
    // the heading appears; waiting on the first cell itself (an
    // auto-retrying `expect`, unlike a one-shot `.count()`) is what
    // actually waits for that fetch to resolve, not just the navigation.
    const firstCell = panel.locator('table').first().locator('td').first();
    await expect(firstCell).toBeVisible({ timeout: 15_000 });

    // Cross-checked against the same trace fetched directly from the
    // backend, so the assertion is an EXACT match against real data, not
    // just "greater than zero" (which a matrix rendered with a single stray
    // cell, or a single stray optimal-path mark, would also satisfy).
    //
    // The exact cell count assumes the WHOLE matrix is rendered, which only
    // holds because DpMatrix.tsx is verified to render every cell directly
    // (a plain scrollable `<table>`, its own comment: "never a windowed or
    // truncated subset" — no virtualization library, since the reference
    // corpus's abstracts are short); it would be wrong to assert this exact
    // number against a component that only renders a visible window.
    //
    // Both counts use `toHaveCount`, a web-first assertion that polls until
    // it holds (or times out), instead of a one-shot `.count()` read: a
    // one-shot count taken right after the heading/status appears can still
    // race the trace fetch that fills the table, reading zero or a partial
    // row before the real content has painted.
    const trace = await fetchSimilarityTrace(request, 'needleman-wunsch', 'd01', 'd02');
    const expectedCellCount = trace.matrix.length * trace.matrix[0].length;
    await expect(panel.locator('table').first().locator('td')).toHaveCount(expectedCellCount);

    // `trace.optimalPath.length` comes straight from the backend response
    // fetched above, not from the UI, so it needs no polling of its own.
    expect(trace.optimalPath.length).toBeGreaterThan(0);
    await expect(panel.locator('[data-optimal-path="true"]')).toHaveCount(trace.optimalPath.length);

    // At least one cell shows a real, non-empty score value (not a blank
    // or placeholder cell).
    const firstCellText = (await firstCell.textContent())?.trim();
    expect(firstCellText).not.toBe('');
    expect(firstCellText).not.toBeUndefined();
  });

  test('has no automatically detectable WCAG 2.1 AA violations on the compare results or the trace view', async ({
    page,
    request,
  }) => {
    const corpus = await fetchCorpus(request);
    const titleA = titleOf(corpus, 'd01');
    const titleB = titleOf(corpus, 'd02');

    await page.goto('/');
    await page.getByRole('checkbox', { name: titleA }).check();
    await page.getByRole('checkbox', { name: titleB }).check();
    await page.getByRole('button', { name: 'Comparar d01 y d02' }).click();
    await expect(page.getByRole('row')).toHaveCount(7);

    let results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);

    await page
      .getByRole('row', { name: 'needleman-wunsch' })
      .getByRole('button', { name: 'needleman-wunsch', exact: true })
      .click();
    const panel = page.getByTestId('trace-detail-panel');
    await expect(panel.getByRole('heading', { name: 'Needleman-Wunsch' })).toBeVisible();
    // Same real-backend loading race as the DP matrix test above: wait for
    // the trace's own content, not just the heading, before scanning.
    await expect(panel.locator('table').first().locator('td').first()).toBeVisible({
      timeout: 15_000,
    });

    results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
