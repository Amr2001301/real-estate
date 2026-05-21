# web-admin E2E (Playwright)

Browser-level smoke coverage for the admin dashboard. Chromium only for now.

## What it covers

`dashboard-smoke.spec.ts` — logs in as the bootstrap admin and verifies every
core route loads (no auth redirect, no error boundary, route heading visible):
`/dashboard`, `/dashboard/leads`, `/dashboard/projects`, `/dashboard/units`,
`/dashboard/customers`, `/dashboard/inventory`, `/dashboard/reports`.

`sales-smoke.spec.ts` — logs in as a SALES rep and verifies: the sales-focused
home (`لوحة المبيعات`, not the admin home); every sales route loads
(`/dashboard/leads`, `/visits`, `/reservations`, `/contracts`, `/projects`,
`/units`, `/inventory`, `/installments`, `/my-compensation`); admin-only nav
links (`المستخدمون`, `الصلاحيات`, `الإعدادات`, `سجلات التدقيق`, plus
`الدفعات`/`الوسطاء`/`العمولات`) are hidden; and admin-only catalog actions
(`إضافة مشروع`, `إضافة وحدة`) are not visible.

`sales-manager-smoke.spec.ts` — logs in as a SALES_MANAGER and verifies: the
team dashboard (`لوحة مدير المبيعات`) with either the team table
(`أداء المندوبين`) or the no-team empty state; every manager route loads
(including `/dashboard/targets` = `أهداف وأداء المبيعات`); the SALES self-view
(`مستحقاتي وأهدافي`) and the admin-only links are hidden; and admin-only actions
(catalog add buttons, the targets `إضافة / تحديث هدف` form) are not visible.

Shared helpers live in `helpers/auth.ts` (login + `loginAsAdmin/Sales/Manager`)
and `helpers/assert.ts` (`assertRouteLoads`, `assertNavLinksHidden`).

> **Deferred — per-record team boundary E2E.** Verifying that a manager gets
> 404 (lead/reservation/contract) or 403 (visit) on an *out-of-team* record
> needs deterministic seed data: a second SALES rep on a different team plus at
> least one lead/visit/reservation/contract per rep. The dev seed only links one
> demo SALES rep to the demo manager, so this is intentionally not automated here
> to avoid flaky in-test data setup. Per-record guard correctness is covered by
> the API unit tests (`common/utils/__tests__/sales-scope.spec.ts` and the
> controller/service checks). Follow-up: add a dedicated E2E seed fixture.

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
| `E2E_SALES_EMAIL` | `sales@example.com` | SALES smoke login (seed demo) |
| `E2E_SALES_PASSWORD` | `SalesPass123!` | SALES smoke password |
| `E2E_MANAGER_EMAIL` | `manager@example.com` | SALES_MANAGER smoke login (seed demo) |
| `E2E_MANAGER_PASSWORD` | `ManagerPass123!` | SALES_MANAGER smoke password |
| `E2E_NO_WEBSERVER` | _(unset)_ | set to `1` to disable Playwright's auto dev server |

Defaults match the dev seed (`apps/api/prisma/seed.ts`): the bootstrap admin and
the demo `sales@example.com` / `manager@example.com` users (the seed also links
the demo SALES rep to the demo manager). Override the credentials in any non-dev
environment — never commit real ones.

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

## Manual verification — automatic sales commission (Batches A–D)

> **Not automated (intentionally).** The dev seed creates **no** BonusRule,
> reservation, or contract, so the full sign→generation path has no deterministic
> fixture. Building one (lead/client → reservation → convert → unsigned contract →
> sign) is multi-step and would make a brittle E2E. Backend correctness is fully
> covered by API tests: generation/idempotency/skips/P2002
> (`apps/api/src/modules/bonus/__tests__/sales-commission-generation.spec.ts`),
> sign-trigger wiring (`contracts/__tests__/contract-signing-workflow.spec.ts`),
> and the single-auto invariant on create + PATCH
> (`bonus/__tests__/bonus-entry-workflow.spec.ts`). Run this checklist manually
> against a seeded stack, or after building the fixture in the TODO below.

Prerequisites: migrations applied + seed run; API + web-admin up; an
**unsigned contract** that has a source reservation with a `salesId`
(create a lead/client → reservation → convert it to a contract as ADMIN).

1. Log in as **ADMIN** → open `/dashboard/bonus`.
2. In **قواعد العمولة**, create **rule A** (e.g. 2%) with **"استخدام تلقائي عند توقيع العقد"** checked.
   - Banner shows: `العمولات التلقائية مفعّلة باستخدام قاعدة: A`.
3. Create **rule B** (e.g. 3%) with the same checkbox checked.
   - Rule A's **"تلقائي عند التوقيع"** badge disappears; banner now reads `… باستخدام قاعدة: B`.
   - No "أكثر من قاعدة تلقائية مفعّلة" warning appears (single-auto invariant on create).
4. **Sign** the unsigned contract as ADMIN (`POST /contracts/:id/sign` via the contract detail page).
5. Back on `/dashboard/bonus` → exactly **one** new entry:
   - **المصدر** = `تلقائي من عقد`, **الحالة** = `معلق` (PENDING),
   - **المبلغ** = contract total × **B**'s percentage,
   - the **"العقد"** link points to the signed contract.
6. Log in as the **SALES** rep who owns that reservation → `/dashboard/my-compensation`
   → the same PENDING entry appears with **المصدر** = `تلقائي من عقد`.
7. **Re-sign** the same contract (sign is idempotent) → **no duplicate** entry is created
   (one row per contract, enforced by the unique `contractId`).
8. As ADMIN, **إلغاء التلقائي** on rule B → banner shows the "no active auto rule" notice.
9. Sign **another** eligible contract → **no** auto entry is generated.
10. Manual entry create + **اعتماد**/**تحديد كمدفوع** still work on any PENDING entry.

> **TODO — deterministic E2E fixture.** Add a seed/test fixture that creates: one
> active auto BonusRule, a SALES-owned reservation, and a convertible/unsigned
> contract with a known `totalAmount`. With that in place, automate steps 4–9 as a
> Playwright spec (assert one PENDING `تلقائي من عقد` entry of the expected amount,
> no duplicate on re-sign, none after disabling auto). Until then this stays a
> manual checklist and the smoke specs are unchanged.
