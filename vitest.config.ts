import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    // Vitest must stay hermetic: it must never depend on a developer's
    // local .env, only on what a test explicitly stubs. `envDir: false`
    // (Vite's own switch to disable .env file loading entirely) is scoped
    // to this file, so `npm run dev` and `npm run build` — which read
    // vite.config.ts directly — keep loading .env exactly as before; only
    // the test run ignores it.
    envDir: false,
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      exclude: ['**/node_modules/**', '**/e2e/**', '**/e2e-fullstack/**', '**/dist/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
        exclude: [
          'src/shared/types/api.ts',
          'src/main.tsx',
          'src/**/*.test.{ts,tsx}',
          'src/**/*.types.test.{ts,tsx}',
        ],
      },
    },
  }),
);
