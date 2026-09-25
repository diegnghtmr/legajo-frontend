import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';
// Initializes the global i18next instance once for every test file, the
// same way `main.tsx` does for the real app; `useTranslation()` needs an
// initialized instance even without an explicit `I18nextProvider`.
import '../infrastructure/i18n';

// jsdom has no `ResizeObserver`; a no-op default keeps every component that
// measures its own layout from crashing on mount. A test that needs to
// observe a real resize installs
// its own controllable fake via `vi.stubGlobal('ResizeObserver', ...)`
// instead of relying on this one, then restores it with
// `vi.unstubAllGlobals()`.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = NoopResizeObserver;
}

// jsdom has no `matchMedia`; a default that always reports "matches" (i.e.
// a desktop-width viewport) keeps every component that checks a breakpoint
// from crashing on mount and keeps every existing test's implicit
// wide-viewport assumption unchanged. A test that needs a narrow viewport
// installs its own controllable fake via `vi.stubGlobal('matchMedia', ...)`
// instead, then restores it with `vi.unstubAllGlobals()`.
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = ((query: string): MediaQueryList => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

// `vitest.config.ts` does not set `test.globals: true` (every test file
// imports its own `describe`/`it`/`expect`), so Testing Library's automatic
// afterEach(cleanup) detection never fires. Without this, unmounted trees
// from a previous test stay in `document.body` and later `getByRole`
// queries in the same file can match duplicates.
afterEach(() => {
  cleanup();
});
