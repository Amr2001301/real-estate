# CLAUDE.md

## Project Overview
Multi-tenant real-estate platform (SaaS) for Egyptian property developers and brokerages.
Provides CRM, sales pipeline, contract/installment management, and public property catalog.
Surfaces: NestJS API, Next.js admin dashboard, Next.js public website, Flutter customer app, Flutter staff app.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Backend | NestJS 10, Node 22, TypeScript 5.6 |
| Database | PostgreSQL 16, Prisma 5.22 ORM |
| Cache / jobs | Redis 7, @nestjs/schedule (in-process cron) |
| Auth | JWT (passport-jwt) + phone OTP; httpOnly cookie session on web |
| Storage | Cloudflare R2 (prod), MinIO (local, S3-compatible) |
| Push | Firebase Admin SDK (FCM) |
| Validation | class-validator on DTOs (API); Zod in shared-types |
| Web Admin | Next.js 15 (App Router), React 19, Tailwind CSS 3.4 |
| Web Public | Next.js 15, next-intl (ar/en, RTL), Tailwind CSS 3.4 |
| Mobile | Flutter 3, Riverpod (state), GoRouter (routing), Dio (HTTP, OpenAPI-generated) |
| Monorepo | pnpm 9 workspaces + Turbo 2.3 |
| Mobile workspace | Melos 7 (Dart pub workspace) |
| Testing | Jest 29 (API unit/e2e), Playwright 1.60 (web e2e) |
| Linting | ESLint 9 (flat config), Prettier 3.3 |
| CI/CD | GitHub Actions → Railway (API) + Vercel (web apps) |
| Observability | Sentry 8, prom-client (Prometheus) |

---

## Repo Structure

```
Real Estate/
├── apps/
│   ├── api/              NestJS backend — all business logic, REST API on :4000
│   ├── web-admin/        Next.js admin/sales dashboard on :3001
│   ├── web-public/       Next.js public marketing + catalog on :3002
│   └── mobile/
│       ├── mobile_customer/  Flutter app for clients/customers (iOS + Android)
│       └── mobile_staff/     Flutter app for sales agents & brokers (iOS + Android)
├── packages/
│   ├── shared-types/     Zod schemas + TS types shared between API and web apps
│   └── tsconfig/         Shared tsconfig bases (base.json, nest.json, next.json)
├── scripts/              DB backup/restore + pre-deploy gate shell scripts
├── docs/                 Architecture decision records, mobile store readiness docs
├── docker-compose.yml    Local dev infra: Postgres 16, Redis 7, MinIO
└── turbo.json            Turbo pipeline config
```

---

## Commands

### Install
```bash
pnpm install
```

### Dev (all apps via Turbo)
```bash
pnpm dev
# or per-app:
pnpm --filter @rep/api dev          # API on :4000
pnpm --filter web-admin dev         # Admin on :3001
pnpm --filter web-public dev        # Public on :3002
```

### Build
```bash
pnpm build                          # all apps via Turbo
```

### Test
```bash
pnpm test                           # all Jest tests via Turbo
pnpm --filter @rep/api test         # API unit tests
pnpm --filter @rep/api test:e2e     # API e2e (Supertest, --runInBand required)
pnpm --filter web-admin e2e         # Playwright (needs chromium: pnpm --filter web-admin e2e:install)
pnpm --filter web-public e2e        # Playwright
```

### Type-check & Lint
```bash
pnpm typecheck                      # all apps
pnpm lint                           # all apps
pnpm format                         # Prettier write
```

### Database
```bash
pnpm db:generate        # prisma generate (after schema changes)
pnpm db:migrate         # prisma migrate dev (creates migration + applies)
pnpm db:deploy          # prisma migrate deploy (CI/prod, no schema drift)
pnpm db:status          # prisma migrate status
pnpm db:seed            # tsx prisma/seed.ts
pnpm db:studio          # Prisma Studio GUI
```

### Mobile (from apps/mobile/)
```bash
melos run gen           # dart run build_runner build (code gen)
melos run analyze       # flutter analyze
melos run test          # flutter test across packages
melos run l10n          # flutter gen-l10n
```

### OpenAPI (mobile client codegen)
```bash
pnpm --filter @rep/api openapi:export   # exports spec → mobile consumes it
```

---

## Architecture Notes

- **Single monolithic API**: no microservices; all cross-module calls are NestJS DI (`NotificationsModule` imported into `LeadsModule`, etc.).
- **Multi-tenancy**: every major model has `companyId`. Tenant resolved from `X-Tenant-Slug` header or hostname. `TenantContextInterceptor` stores context in `AsyncLocalStorage` per request. Prisma middleware enforces tenant scoping.
- **Web ↔ API**: Next.js rewrites `/api-proxy/:path*` → `${API_BASE_URL}/v1/:path*`. Auth via httpOnly cookies; web apps use server actions — no client-side token handling.
- **Mobile ↔ API**: Dio HTTP client (OpenAPI-generated). JWT access + refresh tokens in platform secure storage (Keychain / Keystore). Translatable fields (`{ar, en}`) flattened by `LocaleInterceptor`; Flutter must use `Translatable.fromJson` which tolerates `Map | String | null`.
- **Scheduled jobs**: in-process `@nestjs/schedule` (BullMQ is present but not used). Cron env-gated, jsonb-payload deduplication, direct PrismaClient pattern.
- **Deployment**: API → Railway (Docker multi-stage, Node 22-alpine). Web apps → Vercel (`next build` with `output: 'standalone'`). Mobile → App Store / Google Play (planned, pending credentials).
- **Business logic location**: `apps/api/src/modules/<feature>/<feature>.service.ts`. Controllers are thin (validate, delegate, return).

---

## Conventions to Follow

- **File naming**: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.dto.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.decorator.ts`, `*.spec.ts` — NestJS suffix convention is enforced.
- **Naming**: PascalCase for classes/files, camelCase for vars/functions, `CONSTANT_CASE` for env-sourced constants.
- **Folder layout**: feature-based modules under `src/modules/`; shared infra in `src/common/`.
- **DTOs**: use class-validator decorators; never accept raw `any` at controller boundaries.
- **API errors**: throw NestJS `HttpException` subclasses (`NotFoundException`, `ForbiddenException`, etc.) — do not return `{ error: ... }` manually.
- **Translatable fields**: stored as `{ ar: string, en: string }` JSON in Postgres; flattened to string by `LocaleInterceptor` based on `Accept-Language`. Respect this in new models.
- **Tenant scoping**: every new Prisma query that touches a tenanted model must include `companyId` in the `where` clause. Use ownership guards; never trust the caller's claimed companyId alone.
- **Shared types**: add domain types/schemas to `packages/shared-types`, not inside a single app.
- **Mobile**: Clean Architecture (data / domain / presentation layers); state via Riverpod providers; routing via GoRouter named routes.

---

## Things NOT to Do

- **Do not run `prisma migrate dev` in production** — use `prisma migrate deploy` (or `pnpm db:deploy`).
- **Do not skip `RUN_MIGRATIONS=true`** in local `.env` — the API entrypoint gates on it.
- **Do not add direct Prisma queries in controllers** — queries belong in services.
- **Do not run API e2e tests without `--runInBand`** — parallel runs cause socket/port conflicts.
- **Do not run API e2e (flow-e E5) while MinIO is up** — it conflicts; stop MinIO first.
- **Do not store secrets in files** — bearer tokens stay inline in the shell; never write to `/tmp` or commit `.env`.
- **Do not add `BullMQ` queues** — the codebase uses in-process `@nestjs/schedule`; BullMQ is wired but unused.
- **Do not bypass tenant scoping** — never query a tenanted entity without `companyId`; missing this is a security defect, not a style issue.
- **Do not hard-code `DEFAULT_COMPANY_ID`** — it must come from env; it gates public (`@Public()`) endpoints.
- **Do not use the 5-second timestamp gap as a `hasAccount` heuristic** — check `passwordHash`, `role`, or an explicit `accountStatus` field instead.
