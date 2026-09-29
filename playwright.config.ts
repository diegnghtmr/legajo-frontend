import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // html writes playwright-report/, which CI uploads on failure.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Entry animations fade content in, and axe would measure contrast on a
    // half-transparent frame. The suite runs with reduced motion so every
    // check sees the final state; `motion.spec.ts` opts back in to test motion.
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
