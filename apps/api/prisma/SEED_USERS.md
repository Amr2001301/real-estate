# Seed users — local development & E2E only

> **All credentials in this file are for local development and E2E test
> environments only. They are useless against staging or production —
> those run separate databases with separate, secret passwords.** Never
> set any of these passwords on a non-local database, never commit a
> hashed copy of a real password.

This is the canonical table of who exists in a freshly-seeded DB and what
each account is for. Two seed scripts produce these users:

| Script | Command | Produces |
| --- | --- | --- |
| `prisma/seed.ts` (dev seed) | `pnpm db:seed` | Rows 1–5 below (staff + 1 demo client) |
| `prisma/seed-e2e.ts` (e2e seed) | `pnpm --filter @rep/api prisma:seed:e2e` | Everything (additive — internally runs the dev seed first, then adds rows 6–10 + broker firms + project-access grants for Flow A) |

The e2e seed is **idempotent** — running it twice against the same DB is
a no-op (uses upserts everywhere). It is **safe to extend** with
additional fixtures for future Phase 7B+ flows.

## Users

| # | Email | Password | Role | Created by | Purpose |
| --- | --- | --- | --- | --- | --- |
| 1 | `admin@example.com` | `ChangeMe123!` | `ADMIN` | dev seed | Platform admin. Full admin dashboard. Owns all admin-only actions. Password can be overridden via `SEED_ADMIN_PASSWORD` env. |
| 2 | `sales@example.com` | `SalesPass123!` | `SALES` | dev seed | Sales rep. Reports to `manager@example.com`. Used by admin Playwright `sales-smoke.spec.ts` and mobile staff Sales tests. |
| 3 | `manager@example.com` | `ManagerPass123!` | `SALES_MANAGER` | dev seed | Sales manager. Manages the demo sales rep. Used by admin Playwright `sales-manager-smoke.spec.ts`. |
| 4 | `maintenance@example.com` | `MaintenancePass123!` | `MAINTENANCE_SUPERVISOR` | dev seed | Mobile-only staff role; reads/resolves maintenance requests. No web dashboard. |
| 5 | `ahmed@example.com` (no password — phone only) | — | `CLIENT` | dev seed | Demo client (`+966500000001`) for the seeded lead. Cannot login with password; phone-OTP only. |
| 6 | `broker1@example.com` | `BrokerPass1!!` | `BROKER` | e2e seed | Linked to broker firm `E2E-BROKER-1`. **Has project-access grants** to projects p1 + p2 (see "Broker scoping" below). Drives Flow A test A5. |
| 7 | `broker2@example.com` | `BrokerPass2!!` | `BROKER` | e2e seed | Linked to broker firm `E2E-BROKER-2`. **Has project-access grant** to project p3 only. Drives Flow A test A6 (cross-broker isolation). |
| 8 | `client@example.com` | `ClientPass1!!` | `CLIENT` | e2e seed | Active client used by future Flow B/C (visit requests). |
| 9 | `customer@example.com` | `CustomerPass1!` | `CUSTOMER` | e2e seed | Customer with a contract + deposit + maintenance request (added by e2e seed as `// PHASE_7B` baseline). Drives future Flow E/F. |
| 10 | `customer2@example.com` | `CustomerPass2!` | `CUSTOMER` | e2e seed | Second customer used for cross-account ownership-guard negative tests in future Flow E. |

## Broker scoping

The e2e seed creates two broker firms (idempotent by unique `Broker.code`):

| Broker firm code | `Broker.companyName` | Status | Linked user | `canViewCommissions` |
| --- | --- | --- | --- | --- |
| `E2E-BROKER-1` | E2E Brokerage One | `ACTIVE` | `broker1@example.com` | `true` |
| `E2E-BROKER-2` | E2E Brokerage Two | `ACTIVE` | `broker2@example.com` | `true` |

…and the following `BrokerProjectAccess` grants (idempotent by unique
`(brokerId, projectId)`):

| Broker firm | Granted to projects | Rationale |
| --- | --- | --- |
| `E2E-BROKER-1` | first + second project from `seedPublicDemo()` | A5 — broker1 portal lists exactly these two |
| `E2E-BROKER-2` | third project from `seedPublicDemo()` | A6 — broker2 portal lists exactly this one; **does not** list broker1's grants |
| _(none)_ | fourth project from `seedPublicDemo()` | Negative control — no broker can see it via `/portal/projects` |

The seed picks projects by creation order (`orderBy: { createdAt: 'asc' }`),
not by name, so it stays robust against future renames in the demo dataset.

## Running the seeds

```bash
# Dev seed (idempotent). Set SEED_PUBLIC_DEMO=true to also create the 4 demo
# projects with units/media (needed for the e2e seed to find projects to grant).
pnpm --filter @rep/api prisma:seed                        # staff users + lead sources only
SEED_PUBLIC_DEMO=true pnpm --filter @rep/api prisma:seed  # + the 4 demo projects

# E2E seed (additive — runs dev seed first with SEED_PUBLIC_DEMO=true forced).
# Requires TEST_DATABASE_URL to avoid destructive writes against the dev DB
# when used via test:e2e (the jest globalSetup enforces this); when invoked
# directly with prisma:seed:e2e, it will use DATABASE_URL — so only run that
# against a dedicated e2e DB.
pnpm --filter @rep/api prisma:seed:e2e
```

## Safety rails

- The e2e seed is invoked from the jest globalSetup, which **refuses to
  run** unless:
  - `TEST_DATABASE_URL` is set; AND
  - `TEST_DATABASE_URL !== DATABASE_URL`; AND
  - the database name in `TEST_DATABASE_URL` contains `e2e` or `test`.
- The seed itself uses `upsert` / find-or-create everywhere — running it
  twice in a row produces no extra rows.
- No password from this file is valid against staging or production.
