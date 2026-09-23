import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'playwright-report-fullstack',
      'test-results',
      'test-results-fullstack',
      'src/shared/types/api.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: [
      'scripts/**/*.ts',
      '*.config.ts',
      'playwright.config.ts',
      'playwright.fullstack.config.ts',
      'e2e/**/*.ts',
      'e2e-fullstack/**/*.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
);
