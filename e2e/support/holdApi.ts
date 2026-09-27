import type { Page } from '@playwright/test';

export interface RouteFixture {
  pattern: string;
  json: unknown;
}

export interface HeldApi {
  /** Fulfills every held route with its own fixture. Safe to call once;
   * a route that receives its request after this still resolves
   * immediately, since the shared gate is already settled. */
  release: () => void;
}

/**
 * Holds every given route pattern behind one shared gate: each route only
 * fulfills with its own fixture once `release()` is called. Lets a test
 * measure a region's skeleton box, release the real response, then measure
 * again — the same "hold, measure, release, measure" method every case in
 * `skeleton-layout-shift.spec.ts` uses.
 */
export async function holdApi(page: Page, fixtures: readonly RouteFixture[]): Promise<HeldApi> {
  let resolveGate: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });

  for (const { pattern, json } of fixtures) {
    await page.route(pattern, async (route) => {
      await gate;
      await route.fulfill({ json });
    });
  }

  return {
    release: () => resolveGate(),
  };
}
