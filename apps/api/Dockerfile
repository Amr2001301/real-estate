# syntax=docker/dockerfile:1.7

# ─── Stage 1: workspace install ───────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo

RUN apk add --no-cache libc6-compat openssl \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate

# Copy only what's needed to resolve the workspace graph.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web-admin/package.json apps/web-admin/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo

RUN apk add --no-cache libc6-compat openssl \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/shared-types/node_modules ./packages/shared-types/node_modules

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm --filter @rep/api prisma:generate \
 && pnpm --filter @rep/api build

# ─── Stage 3: prod deps only ─────────────────────────────────────────────────
FROM node:20-alpine AS prod-deps
WORKDIR /repo

RUN apk add --no-cache libc6-compat openssl \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages ./packages

RUN pnpm install --frozen-lockfile --prod --filter @rep/api...

# ─── Stage 4: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini \
 && addgroup -S nodejs && adduser -S -G nodejs node-app

ENV NODE_ENV=production \
    PORT=4000

COPY --from=prod-deps --chown=node-app:nodejs /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node-app:nodejs /repo/apps/api/node_modules ./node_modules-api
COPY --from=prod-deps --chown=node-app:nodejs /repo/packages ./packages

COPY --from=builder --chown=node-app:nodejs /repo/apps/api/dist ./dist
COPY --from=builder --chown=node-app:nodejs /repo/apps/api/prisma ./prisma
COPY --from=builder --chown=node-app:nodejs /repo/apps/api/package.json ./package.json

# Merge api-local node_modules over root if needed (pnpm hoists most things to /repo/node_modules)
RUN cp -rn ./node_modules-api/* ./node_modules/ 2>/dev/null || true \
 && rm -rf ./node_modules-api

COPY --chown=node-app:nodejs apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node-app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
