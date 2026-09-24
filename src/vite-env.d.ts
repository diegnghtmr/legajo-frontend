/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the backend API, resolved at build time.
   * Empty or absent in development: the Vite proxy in
   * `vite.config.ts` (`/api` -> `http://localhost:8080`) handles it. Must be
   * set in a production build (see `src/infrastructure/env.ts`).
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
