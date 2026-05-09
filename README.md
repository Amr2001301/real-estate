# Real Estate Platform

A four-surface real-estate platform: a Public Website (browse projects/units), an Admin Dashboard (manage everything), a Sales Mobile App (CRM/leads/visits), and a Client/Customer Mobile App (favorites, visit requests, post-purchase ownership).

## Stack

| Surface | Tech |
| --- | --- |
| Backend | NestJS 10 · Prisma 5 · PostgreSQL · Redis (BullMQ) · Cloudflare R2 (presigned uploads) · Firebase Admin (FCM) |
| Web (Public) | Next.js 15 App Router · ISR · `next-intl` (ar/en, RTL) |
| Web (Admin) | Next.js 15 App Router · TailwindCSS · server actions for auth |
| Mobile (Sales, Client) | Flutter 3 · Riverpod · GoRouter · Dio (generated from OpenAPI) |
| Hosting | Railway (API + Postgres + Redis) · Vercel (both web apps) |

## Repository layout

```
apps/
├── api/                NestJS backend
├── web-public/         (Phase 2)
├── web-admin/          Next.js admin dashboard
├── mobile-client/      (Phase 3 — Flutter)
└── mobile-sales/       (Phase 4 — Flutter)
packages/
├── shared-types/       Zod schemas + TS types shared between API and web apps
├── tsconfig/           Base, Nest, Next TS configs
└── eslint-config/      (placeholder)
```

## Prerequisites

- Node.js ≥ 20.10
- pnpm ≥ 9
- Docker (for Postgres + Redis), or local installs

## Quick start (local dev)

```bash
# 1) Install
pnpm install

# 2) Start Postgres + Redis (one-liner with Docker)
docker run -d --name rep-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker run -d --name rep-redis -p 6379:6379 redis:7

# 3) Configure env
cp apps/api/.env.example apps/api/.env
cp apps/web-admin/.env.example apps/web-admin/.env

# 4) Generate Prisma client + migrate + seed
pnpm db:generate
pnpm db:migrate     # creates schema in dev DB
pnpm db:seed        # admin@example.com / ChangeMe123!

# 5) Run API + Admin in parallel
pnpm dev
```

API: http://localhost:4000/v1 (Swagger: http://localhost:4000/docs)
Admin: http://localhost:3001

## Default seeded credentials

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `ChangeMe123!` |
| Sales | `sales@example.com` | `SalesPass123!` |

(Override admin via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.)

## Architecture notes

- **Auth.** Phone OTP for clients (mobile), email + password for Admin/Sales (web). Both flows return JWT access + refresh tokens; refresh tokens are hashed at rest and rotated on use.
- **Roles.** `ADMIN`, `SALES`, `CLIENT`, `CUSTOMER`. Customers are created by promotion when an Admin creates a contract for a Client.
- **Translatable fields.** Project names/descriptions, lead-source names, banner titles etc. are stored as `{ ar, en }` JSON. The `LocaleInterceptor` flattens them based on `Accept-Language`; the admin opts out via `X-Raw-Translatable: 1` for editing.
- **Reservation lifecycle.** Sales creates a `Reservation` → unit becomes `RESERVED`. A 5-minute cron expires pending reservations past `expiresAt` and frees the unit back to `AVAILABLE`.
- **Contracts → Customers.** Creating a contract for a `CLIENT` user promotes them to `CUSTOMER` and marks the unit `SOLD`.
- **Installments.** Plans are created by Admin and visible to Admin/Sales only. The plan auto-generates monthly `Installment` rows. A daily cron flips `PENDING` past `dueDate` to `OVERDUE`.
- **Deposits.** Recorded by Admin only (per scope). Customer endpoints are read-only (`GET /me/deposits`).
- **Audit log.** A global interceptor captures actor + action + entity + payload for every mutation outside of `auth/login` and `auth/otp`.

## Phase plan

1. **Phase 1 — Backend + Admin** (current): all modules and a runnable admin dashboard for project/lead/contract/deposit management.
2. **Phase 2 — Public Website**: ISR-based marketing site with bilingual UI, on-demand revalidation when admin publishes a project.
3. **Phase 3 — Client/Customer Mobile (Flutter)**: OTP login, favorites, visit requests, customer-only My Property/Deposits/Contracts/Maintenance.
4. **Phase 4 — Sales Mobile (Flutter)**: CRM pipeline (kanban), leads timeline, installment calculator, reservations, bonus dashboard.

## Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run all apps in dev (Turbo) |
| `pnpm build` | Build all apps |
| `pnpm typecheck` | Run TS typecheck across the workspace |
| `pnpm db:migrate` | Apply Prisma migrations (dev) |
| `pnpm db:seed` | Seed sample data |
| `pnpm db:studio` | Open Prisma Studio |

## Out of scope (per the platform scope PDF)

- Electronic payment / payment gateway — admin records deposits manually.
- Public-facing installment plan visibility — Sales/Admin only.
- Customer-side payment recording — Admin records deposits.
