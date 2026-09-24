# syntax=docker/dockerfile:1
#
# Legajo frontend image (TRD §14.2): a multi-stage build that compiles the
# Vite bundle with Node 24, then serves the static output with nginx. The
# local Compose stack (backend repo) runs this same image, as would any
# other Docker-based host; no runtime Node ships in the final image.
#
# Base images below are pinned by tag, not by digest — the same decision the
# backend repo's own Dockerfile documents, for consistency across the two
# images: a tag already pins the exact upstream version this team develops
# against (`node:24-alpine`, `nginxinc/nginx-unprivileged:1.27-alpine`),
# stays readable in a diff (a digest is an opaque hash), and needs no manual
# digest-bump step whenever the upstream image republishes the same tag with
# a security patch — a digest pin would silently stop receiving those
# patches until someone remembers to update it by hand.

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
# There is no default: a silently-applied default could ship a bundle that
# points at the wrong API without anyone noticing, so every caller passes
# it explicitly — the default-profile Compose stack (TRD §14.1/§14.2:
# backend on :8080), the `image-smoke` CI job, and any manual build (see
# README "Running with Docker").
ARG VITE_API_BASE_URL
# The guard and the build run in the SAME shell (one RUN), not a guard RUN
# followed by a separate `ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}`: an
# `ENV` instruction can only read the original ARG, not a shell variable a
# prior RUN computed, so a previous version of this check validated
# `trimmed` but then still exported the untrimmed `$VITE_API_BASE_URL` to
# the build — a value with surrounding whitespace (e.g.
# `--build-arg 'VITE_API_BASE_URL= http://localhost:8080 '`) passed the
# guard yet still reached Vite with the whitespace intact. Prefixing `npm
# run build` with `VITE_API_BASE_URL="$trimmed"` guarantees the exact value
# that was validated is the exact value Vite inlines into the bundle.
#
# Only LEADING/TRAILING whitespace is trimmed (`awk`, not `tr -d`): an
# earlier version of this guard used `tr -d '[:space:]'`, which removes
# EVERY whitespace character, including in the middle of the value — a typo
# like `--build-arg 'VITE_API_BASE_URL=http://local host:8080'` silently
# became the working-looking `http://localhost:8080` instead of failing
# loudly, defeating the entire point of this guard (never silently correct
# a value that might not be what the caller meant). Any whitespace still
# left after trimming only the ends is therefore rejected outright, not
# repaired.
#
# `awk` (with `RS="\0"` so it reads the whole value as one record), not a
# line-oriented `sed`: `sed`'s `^`/`$` anchors match the start/end of EACH
# LINE, not the whole value, so a `--build-arg` value with a leading or
# trailing NEWLINE (e.g. from a YAML block scalar) passed through unstripped
# under the old `sed` form — not silently accepted (the leftover newline
# still tripped the interior-whitespace check below and failed the build),
# but for the wrong stated reason, and a value that was ONLY newline-padded
# was rejected instead of cleanly trimmed the way pure-space padding already
# was. `awk`'s `RS="\0"` slurps the value as a single record, so `gsub` on a
# leading/trailing run of any whitespace class (including `\n`) actually
# trims it, the same way the surrounding-space case already worked.
RUN trimmed="$(printf '%s' "$VITE_API_BASE_URL" | awk 'BEGIN{RS="\0"} {gsub(/^[ \t\r\n]+|[ \t\r\n]+$/, ""); printf "%s", $0}')"; \
    if [ -z "$trimmed" ]; then \
      echo "ERROR: --build-arg VITE_API_BASE_URL is required and must not be empty or whitespace-only." >&2; \
      echo "  Vite inlines it into the bundle at build time (TRD Appendix A); an" >&2; \
      echo "  unset/blank value would silently ship a bundle pointing at the wrong API." >&2; \
      echo "  Docker/Compose build: --build-arg VITE_API_BASE_URL=http://localhost:8080" >&2; \
      echo "  Vercel: set VITE_API_BASE_URL as a Project Environment Variable instead —" >&2; \
      echo "  Vercel builds this app with Vite directly, not through this Dockerfile." >&2; \
      exit 1; \
    fi; \
    case "$trimmed" in \
      *[[:space:]]*) \
        echo "ERROR: --build-arg VITE_API_BASE_URL must not contain whitespace inside the value (surrounding whitespace is trimmed; interior whitespace is rejected, never silently removed)." >&2; \
        echo "  got: '$VITE_API_BASE_URL'" >&2; \
        exit 1; \
        ;; \
    esac; \
    VITE_API_BASE_URL="$trimmed" npm run build

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
