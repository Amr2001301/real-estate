# syntax=docker/dockerfile:1.7

# ─── Stage 1: workspace install ───────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /repo

RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web-public/package.json apps/web-public/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /repo

RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web-public/node_modules ./apps/web-public/node_modules
COPY --from=deps /repo/packages/shared-types/node_modules ./packages/shared-types/node_modules

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/web-public ./apps/web-public

# API_BASE_URL is read at runtime by Next.js server components / fetch rewrites.
ENV API_BASE_URL=http://api:4000 \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @rep/web-public build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache tini \
 && addgroup -S nodejs && adduser -S -G nodejs nextjs

ENV NODE_ENV=production \
    PORT=3002 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# next.config.ts `output: 'standalone'` produces a self-contained server.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web-public/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web-public/.next/static ./apps/web-public/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web-public/public ./apps/web-public/public

USER nextjs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web-public/server.js"]
