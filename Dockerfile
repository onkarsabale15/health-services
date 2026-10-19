# syntax=docker/dockerfile:1
#
# Production image for ANY backend service in this monorepo.
# Build with the target service's workspace name (without the @hs/ prefix):
#
#   docker build --build-arg APP_NAME=admin-api -t health-services/admin-api .
#
# APP_NAME ∈ admin-api | bridge-api | cds-app | mcp-app | workflow-app | terminology-sync
#
# Uses `turbo prune` so the image self-adjusts to the dependency graph — adding
# or renaming a package never requires touching this file.

ARG NODE_IMAGE=node:20-alpine

# ── base ─────────────────────────────────────────────────────────────────────
# Node + turbo + the native libs Prisma's query engine needs on Alpine.
FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat openssl
RUN npm install -g turbo@2.9.16
WORKDIR /app

# ── pruner ───────────────────────────────────────────────────────────────────
# Compute the minimal workspace subset needed to build APP_NAME.
# Emits /app/out/json (manifests + lockfile) and /app/out/full (pruned source).
FROM base AS pruner
ARG APP_NAME
COPY . .
RUN turbo prune "@hs/${APP_NAME}" --docker

# ── installer ────────────────────────────────────────────────────────────────
# Install deps (cached on the manifest layer), then build the target app.
FROM base AS installer
ARG APP_NAME

# Manifests first → this layer (and the install below) only re-runs when a
# package.json or the lockfile changes, not on every source edit.
COPY --from=pruner /app/out/json/ ./
# The root `postinstall` runs `prisma generate`, so the schema must be present
# before install.
COPY --from=pruner /app/packages/infra/prisma ./packages/infra/prisma
# `npm ci` (not `npm install`) so locked versions are installed exactly — loose
# installs re-resolve OpenTelemetry's tightly-coupled packages out of alignment.
RUN npm config set fetch-timeout 600000 && npm ci

# Full pruned source + the root tsconfig packages extend, then build.
COPY --from=pruner /app/out/full/ ./
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
RUN turbo run build --filter="@hs/${APP_NAME}"

# NOTE: we intentionally do NOT `npm prune --omit=dev` here. Pruning mutates the
# resolved tree and breaks OpenTelemetry's @opentelemetry/core ↔ sdk-trace-base
# version alignment (runtime-critical). The full install ships instead.

# ── runner ───────────────────────────────────────────────────────────────────
# Minimal runtime: prod node_modules + built output only, non-root, dumb-init PID 1.
FROM ${NODE_IMAGE} AS runner
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init openssl
WORKDIR /app

# `turbo prune` already narrowed packages/ to just this app's deps, so copying
# the whole (built) tree stays minimal without hardcoding a package list.
COPY --from=installer --chown=node:node /app/node_modules ./node_modules
COPY --from=installer --chown=node:node /app/packages ./packages
COPY --from=installer --chown=node:node /app/apps/${APP_NAME} ./apps/${APP_NAME}
COPY --from=installer --chown=node:node /app/package.json ./package.json

USER node

# PORT is injected by the platform at runtime (e.g. DigitalOcean sets it from the
# component's http_port); EXPOSE is informational only and overridable at build.
ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

# dumb-init as PID 1 → proper signal forwarding (clean SIGTERM → graceful
# shutdown) and zombie reaping. `exec` so node replaces the shell.
CMD ["sh", "-c", "exec dumb-init node apps/$APP_NAME/dist/main.js"]
