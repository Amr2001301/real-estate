# web-admin E2E (Playwright)

Browser-level smoke coverage for the admin dashboard. Chromium only for now.

## What it covers

`dashboard-smoke.spec.ts` — logs in as the bootstrap admin and verifies every
core route loads (no auth redirect, no error boundary, route heading visible):
`/dashboard`, `/dashboard/leads`, `/dashboard/projects`, `/dashboard/units`,
`/dashboard/customers`, `/dashboard/inventory`, `/dashboard/reports`.

## Prerequisites

The E2E suite drives the real app against a real API — it does **not** mock the
backend. Before running you need:

1. **API running + seeded** (default `http://localhost:4000`):
   ```bash
   pnpm --filter @rep/api prisma:seed   # creates the bootstrap admin
   pnpm --filter @rep/api dev
   ```
2. **Chromium browser binary** (one-time):
   ```bash
   pnpm --filter @rep/web-admin e2e:install
   ```
3. The **web-admin server** on `E2E_BASE_URL` (default `http://localhost:3001`).
   Playwright will start `pnpm dev` for you and reuse an already-running
   instance. Set `E2E_NO_WEBSERVER=1` to manage it yourself.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3001` | web-admin origin under test |
| `E2E_ADMIN_EMAIL` | `admin@example.com` | login email (seed admin) |
| `E2E_ADMIN_PASSWORD` | `ChangeMe123!` | login password (seed admin) |
| `E2E_NO_WEBSERVER` | _(unset)_ | set to `1` to disable Playwright's auto dev server |

Defaults match the dev seed admin (`apps/api/prisma/seed.ts`). Override the
credentials in any non-dev environment — never commit real ones.

## Run

```bash
# one-time browser install
pnpm --filter @rep/web-admin e2e:install

# headless
pnpm --filter @rep/web-admin e2e

# interactive UI mode
pnpm --filter @rep/web-admin e2e:ui
```

## CI

The suite is CI-ready (`forbidOnly`, 1 retry, single worker, GitHub reporter)
but is **not yet wired into `.github/workflows/ci.yml`** — that needs a job
that boots Postgres + the API + seeds it before running `e2e`. Tracked as a
follow-up.
