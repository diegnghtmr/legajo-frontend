# syntax=docker/dockerfile:1
#
# Legajo frontend image (TRD §14.2): a multi-stage build that compiles the
# Vite bundle with Node 24, then serves it as static files from nginx. This
# is the same image the local Compose stack (backend repo) and, later, a
# Docker-based host run — no runtime Node in the shipped image.

##### Build stage ############################################################
FROM node:24-alpine AS build
WORKDIR /workspace

# Install dependencies in their own layer so an unrelated source change
# doesn't invalidate `npm ci`'s cache.
COPY package.json package-lock.json ./
RUN npm ci

# `npm run build` is `tsc -b && vite build`. `tsc -b` builds both
# tsconfig.app.json (src/) AND tsconfig.node.json, which includes
# vite.config.ts, vitest.config.ts, playwright.config.ts, scripts/**/*.ts and
# e2e/**/*.ts — so the full tree is needed here, not just src/. .dockerignore
# still keeps node_modules, dist, coverage, playwright-report, test-results,
# .git and any .env* file out of this build context.
COPY . .

# Build-time API base URL (TRD §14.2, Appendix A): Vite inlines it into the
# bundle at build time (src/infrastructure/env.ts requires an absolute URL
# for a production build), so it cannot be changed after `npm run build`.
# The default targets the backend service name/port of the default-profile
# Compose stack (TRD §14.1/§14.2: backend on :8080); override with
# `--build-arg VITE_API_BASE_URL=...` for CI or another deployed target.
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

##### Runtime stage ###########################################################
# nginx-unprivileged (not the official nginx image) so the container never
# runs as root. It listens on :8080 (unprivileged ports only) instead of
# :80 — the host-facing :80 that TRD §14.2/Compose expects is a port
# *mapping* applied by the caller (e.g. `docker run -p 80:8080 ...`, or the
# backend repo's Compose `ports:`), not something this image does itself.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
