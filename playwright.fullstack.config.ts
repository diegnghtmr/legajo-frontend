import { defineConfig, devices } from '@playwright/test';

/**
 * Full-stack e2e config: a completely separate
 * Playwright project from `playwright.config.ts`. Two things keep the two
 * suites from ever mixing:
 *
 *   - `testDir: './e2e-fullstack'` vs. the mocked suite's `./e2e` — running
 *     `npx playwright test` with no `--config` still only picks up the
 *     mocked suite (its own `playwright.config.ts` is the default config
 *     file Playwright loads), and `npm run e2e:fullstack` always passes
 *     `--config=playwright.fullstack.config.ts` explicitly so this suite is
 *     never picked up by accident either.
 *   - No `webServer`: the mocked suite's config boots `vite preview` and
 *     talks to it in isolation. This suite talks to a real, already-running
 *     Compose stack (`scripts/e2e-fullstack-in-docker.sh` brings it up and
 *     tears it down); Playwright must never start or manage that stack
 *     itself, or a failed compose-up would surface as a confusing Playwright
 *     "webServer" timeout instead of the real error.
 *
 * `baseURL` is the frontend origin the browser navigates to — the Compose
 * stack's published `:80` by default, overridable via
 * `E2E_BASE_URL` for a non-default `LEGAJO_FRONTEND_PORT`. The real backend
 * origin the specs call directly (`GET /api/v1/corpus`, etc., to fetch real
 * ids/titles and cross-check UI values) is a separate constant,
 * `BACKEND_BASE_URL` in `e2e-fullstack/support/backend.ts`, not `baseURL`
 * here — the two services are two different origins on this stack.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost';

export default defineConfig({
  testDir: './e2e-fullstack',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Separate report/output directories from the mocked suite's
  // `playwright-report/`/`test-results/`, so running both suites back to
  // back (or in parallel) never has one overwrite the other's artifacts.
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-fullstack' }]],
  outputDir: 'test-results-fullstack',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Same reason as the mocked suite: entry animations fade content in, and
    // axe would measure contrast on a half-transparent frame.
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
