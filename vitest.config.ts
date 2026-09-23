import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
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
