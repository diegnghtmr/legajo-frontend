import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// `vitest.config.ts` does not set `test.globals: true` (every test file
// imports its own `describe`/`it`/`expect`), so Testing Library's automatic
// afterEach(cleanup) detection never fires. Without this, unmounted trees
// from a previous test stay in `document.body` and later `getByRole`
// queries in the same file can match duplicates.
afterEach(() => {
  cleanup();
});
