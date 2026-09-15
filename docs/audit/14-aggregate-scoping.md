# Aggregate Scoping Audit — Report 14

**Date:** 2026-09-14  
**Scope:** Every `count`, `aggregate`, `groupBy`, `findMany` used as an aggregate, and `$queryRaw` call across all report and summary endpoints.  
**Auditor methodology:** Line-by-line read of each service + cross-check against `MODEL_TENANCY` classification in `model-tenancy.ts`.

---

## Background

**V-25** and **V-26** (fixed in commit `4995e95`) proved that `reports.service.ts` called `prisma.user.count()` twice without a `companyId` filter. The User model is `TENANT_CONTROLLED` — the Prisma middleware does **not** auto-inject `companyId` for it; callers must inject it explicitly. Both calls were replaced with `scopedUserCount()`.

That discovery prompted this full audit: every aggregate in every report endpoint, not just the ones touched by the User fix.

---

## Tenancy classification reference

| Tier | Prisma middleware behavior | companyId needed in query? |
|---|---|---|
| `TENANT_OWNED` | Middleware auto-injects `companyId` from ALS on every query | **No** — middleware handles it |
| `TENANT_CONTROLLED` | Middleware does NOT inject `companyId` | **Yes** — caller must include it |
| `TENANT_VIA_RELATION` | No direct `companyId`; scoped by FK to an owned parent | **No** — inheritance from parent |
| `PLATFORM_GLOBAL` | No company concept | n/a |

Key `TENANT_CONTROLLED` models (the dangerous ones): **User**, **OtpCode**, **CompanyDomain**.

Raw SQL via `$queryRaw` bypasses the middleware entirely and must always include an explicit `companyId` condition.

---

## 1. `reports.service.ts`

### 1.1 `kpis()` — lines 67–99

All queries target `TENANT_OWNED` models. Middleware handles scoping.

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| 68 | `project.count` | Project | TENANT_OWNED | middleware | ✓ |
| 69 | `unit.count(AVAILABLE)` | Unit | TENANT_OWNED | middleware | ✓ |
| 70 | `unit.count(RESERVED)` | Unit | TENANT_OWNED | middleware | ✓ |
| 71 | `unit.count(SOLD)` | Unit | TENANT_OWNED | middleware | ✓ |
| 72 | `unit.count(total)` | Unit | TENANT_OWNED | middleware | ✓ |
| 73 | `lead.count(total)` | Lead | TENANT_OWNED | middleware | ✓ |
| 74 | `lead.count(new)` | Lead | TENANT_OWNED | middleware | ✓ |
| 75 | `visitRequest.count(PENDING)` | VisitRequest | TENANT_OWNED | middleware | ✓ |
| 76 | `contract.count` | Contract | TENANT_OWNED | middleware | ✓ |
| 77 | `deposit.aggregate(_sum.amount)` | Deposit | TENANT_OWNED | middleware | ✓ |
| 78 | `maintenanceRequest.count` | MaintenanceRequest | TENANT_OWNED | middleware | ✓ |
| 79 | `deposit.count(PENDING)` | Deposit | TENANT_OWNED | middleware | ✓ |

### 1.2 `sales()` — lines 101–141

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| 102 | `getRequiredCompanyId()` | — | — | extracted from ALS | ✓ |
| 122 | `contract.count({ where })` | Contract | TENANT_OWNED | middleware | ✓ |
| 123 | `contract.aggregate(_sum.totalAmount)` | Contract | TENANT_OWNED | middleware | ✓ |
| 124–134 | `$queryRaw` — by-project breakdown | Contract (raw SQL) | raw | `c."companyId" = ${companyId}::uuid` explicit | ✓ (post-fix) |

**NEW-1 (fixed 2026-09-15):** Line 104 originally used `${companyId}` without `::uuid`. PostgreSQL 16 rejected `uuid = text` with error 42883, crashing the endpoint for every request. See Section 5.

### 1.3 `financial()` — lines 143–165

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| 156 | `deposit.count` | Deposit | TENANT_OWNED | middleware | ✓ |
| 157 | `deposit.aggregate(_sum.amount)` | Deposit | TENANT_OWNED | middleware | ✓ |
| 158 | `deposit.count(verified)` | Deposit | TENANT_OWNED | middleware | ✓ |

### 1.4 `reservations()` — lines 167–186

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| 180 | `reservation.groupBy(by: ['status'])` | Reservation | TENANT_OWNED | middleware | ✓ |

### 1.5 `salesFunnel()` — lines 188–202

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| 191 | `lead.count(total)` | Lead | TENANT_OWNED | middleware | ✓ |
| 192 | `lead.count(converted)` | Lead | TENANT_OWNED | middleware | ✓ |
| 193 | `visitRequest.count(COMPLETED)` | VisitRequest | TENANT_OWNED | middleware | ✓ |
| 194 | `reservation.count(APPROVED)` | Reservation | TENANT_OWNED | middleware | ✓ |
| 195 | `contract.count(signed)` | Contract | TENANT_OWNED | middleware | ✓ |

### 1.6 `brokerLeaderboard()` — lines 204–231

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| 205 | `getRequiredCompanyId()` | — | — | extracted from ALS | ✓ |
| 213–230 | `$queryRaw` — broker commission totals | BrokerCommission (raw SQL) | raw | `bc."companyId" = ${companyId}::uuid` explicit | ✓ (post-fix) |

**NEW-2 (fixed 2026-09-15):** Line 207 originally used `${companyId}` without `::uuid`. Same crash as NEW-1.

### 1.7 `salesTrend()` — lines 233–263

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| 234 | `getRequiredCompanyId()` | — | — | extracted from ALS | ✓ |
| 242 | `$queryRaw` — optional projectId filter | Phase (raw SQL) | raw | `ph."projectId" = ${projectId}::uuid` | ✓ (post-fix) |
| 244–256 | `$queryRaw` — monthly contract trend | Contract (raw SQL) | raw | `c."companyId" = ${companyId}::uuid` explicit | ✓ (post-fix) |

**NEW-3 (fixed 2026-09-15):** Lines 242 and 253 originally lacked `::uuid`. Line 253 crashed unconditionally. Line 242 would crash only when `projectId` is supplied — a latent bug on the filtered path.

### 1.8 `adminSummary()` — lines 271–458

This is a single `$transaction` with ~30 parallel queries.

| Lines | Aggregate | Model | Tier | companyId in query? | Correct? |
|-------|-----------|-------|------|---------------------|----------|
| ~290 | `project.count` | Project | TENANT_OWNED | middleware | ✓ |
| ~291 | `unit.count(total)` | Unit | TENANT_OWNED | middleware | ✓ |
| ~292 | `unit.count(AVAILABLE)` | Unit | TENANT_OWNED | middleware | ✓ |
| ~293 | `unit.count(RESERVED)` | Unit | TENANT_OWNED | middleware | ✓ |
| ~294 | `unit.count(SOLD)` | Unit | TENANT_OWNED | middleware | ✓ |
| ~296 | `lead.count` | Lead | TENANT_OWNED | middleware | ✓ |
| ~297 | `lead.count(new, 30d)` | Lead | TENANT_OWNED | middleware | ✓ |
| ~299 | `visitRequest.count(PENDING)` | VisitRequest | TENANT_OWNED | middleware | ✓ |
| ~300 | `reservation.count(active)` | Reservation | TENANT_OWNED | middleware | ✓ |
| ~301 | `contract.count` | Contract | TENANT_OWNED | middleware | ✓ |
| ~302 | `contract.count(signed)` | Contract | TENANT_OWNED | middleware | ✓ |
| ~304 | `deposit.aggregate(_sum.amount)` | Deposit | TENANT_OWNED | middleware | ✓ |
| ~305 | `deposit.count(PENDING_REVIEW)` | Deposit | TENANT_OWNED | middleware | ✓ |
| ~307 | `maintenanceRequest.count(OPEN)` | MaintenanceRequest | TENANT_OWNED | middleware | ✓ |
| ~308 | `infoRequest.count(OPEN)` | InfoRequest | TENANT_OWNED | middleware | ✓ |
| ~309 | `visitRequest.count(awaiting)` | VisitRequest | TENANT_OWNED | middleware | ✓ |
| ~310 | `reservation.count(expiring)` | Reservation | TENANT_OWNED | middleware | ✓ |
| ~311 | `contract.count(awaiting signature)` | Contract | TENANT_OWNED | middleware | ✓ |
| **V-25** (fixed) | `scopedUserCount({ role: CUSTOMER })` | User | TENANT_CONTROLLED | `companyId` injected by helper | ✓ (post-fix) |
| **V-26** (fixed) | `scopedUserCount({ active: true })` | User | TENANT_CONTROLLED | `companyId` injected by helper | ✓ (post-fix) |

### 1.9 `reservationTrend()` — lines 461–481 (private)

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| ~470 | `reservation.count` × 6 (per month) | Reservation | TENANT_OWNED | middleware | ✓ |

### 1.10 `leadSourceDistribution()` — lines 483–503 (private)

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| ~489 | `lead.groupBy(by: ['source'])` | Lead | TENANT_OWNED | middleware | ✓ |
| ~494 | `leadSource.findMany` | LeadSource | TENANT_OWNED | middleware | ✓ |

### 1.11 `recentActivity()` — lines 511–649 (private)

All `findMany` calls for activity feed — all TENANT_OWNED:

| Model | Tier | Correct? |
|-------|------|----------|
| Lead | TENANT_OWNED | ✓ |
| Reservation | TENANT_OWNED | ✓ |
| Contract | TENANT_OWNED | ✓ |
| VisitRequest | TENANT_OWNED | ✓ |
| MaintenanceRequest | TENANT_OWNED | ✓ |
| Deposit | TENANT_OWNED | ✓ |
| InfoRequest | TENANT_OWNED | ✓ |

### 1.12 `topProjects()` — lines 651–714 (private)

| Line | Aggregate | Model | Tier | companyId in query? | Correct? |
|------|-----------|-------|------|---------------------|----------|
| ~660 | `project.findMany` (with nested contract/deposit counts) | Project | TENANT_OWNED | middleware | ✓ |

### 1.13 `financialDashboard()` — lines 876–1648

The largest method in the service. Two parallel `Promise.all` batches, totalling ~30 aggregate calls, plus a 6-month trend loop (12 more calls).

**Batch 1 (lines 1073–1181):**

| Line | Aggregate | Model | Tier | companyId? | Correct? |
|------|-----------|-------|------|------------|----------|
| 1075 | `contract.aggregate(_sum.totalAmount)` | Contract | TENANT_OWNED | middleware | ✓ |
| 1079–1082 | `deposit.aggregate(_sum.amount)` (filteredDep, instAnd) | Deposit | TENANT_OWNED | middleware | ✓ |
| 1083–1088 | `installment.aggregate(_sum.amount)` × 2 (remaining + overdue) | Installment | TENANT_OWNED | middleware | ✓ |
| 1094–1097 | `deposit.aggregate(_sum.amount)` (this month) | Deposit | TENANT_OWNED | middleware | ✓ |
| 1098–1104 | `installment.aggregate(_sum.amount)` (due this month) | Installment | TENANT_OWNED | middleware | ✓ |
| 1106 | `contract.count` | Contract | TENANT_OWNED | middleware | ✓ |
| 1107 | `deposit.count` | Deposit | TENANT_OWNED | middleware | ✓ |
| 1108–1110 | `installment.count(OVERDUE)` | Installment | TENANT_OWNED | middleware | ✓ |
| 1112–1117 | `installment.findMany(OVERDUE)` | Installment | TENANT_OWNED | middleware | ✓ |
| 1119–1137 | `installment.findMany` × 2 (upcoming week/month) | Installment | TENANT_OWNED | middleware | ✓ |
| 1139–1167 | `deposit.findMany(recent)` | Deposit | TENANT_OWNED | middleware | ✓ |
| 1169–1180 | `installment.aggregate` × 3 (30/60/90 day forecast) | Installment | TENANT_OWNED | middleware | ✓ |

**Batch 2 (lines 1257–1285) — computed receivables, aging, booking:**

| Line | Aggregate | Model | Tier | companyId? | Correct? |
|------|-----------|-------|------|------------|----------|
| 1258 | `deposit.aggregate(_sum.amount, verified)` | Deposit | TENANT_OWNED | middleware | ✓ |
| 1259–1264 | `deposit.groupBy(by: ['type','verified'])` | Deposit | TENANT_OWNED | middleware | ✓ |
| 1265–1284 | `installment.aggregate` × 5 (outstanding, due-soon, overdue-computed, aging 1–4) | Installment | TENANT_OWNED | middleware | ✓ |
| 1279–1280 | `reservation.count` × 2 (PENDING/APPROVED) | Reservation | TENANT_OWNED | middleware | ✓ |
| 1281–1284 | `reservation.aggregate(_sum.bookingAmount)` × 2 | Reservation | TENANT_OWNED | middleware | ✓ |
| 1283–1284 | `deposit.aggregate(_sum.amount)` × 2 (booking: verified/all) | Deposit | TENANT_OWNED | middleware | ✓ |

**Batch 3 (lines 1397–1411) — commissions & liabilities:**

| Line | Aggregate | Model | Tier | companyId? | Correct? |
|------|-----------|-------|------|------------|----------|
| 1398–1400 | `bonusEntry.aggregate` × 3 (PENDING/APPROVED/PAID) | BonusEntry | TENANT_OWNED | middleware | ✓ |
| 1401–1404 | `brokerCommission.aggregate` × 4 (by status/unpaid) | BrokerCommission | TENANT_OWNED | middleware | ✓ |
| 1405–1410 | `brokerPayout.groupBy(by: ['status'])` | BrokerPayout | TENANT_OWNED | middleware | ✓ |

**Batch 4 (lines 1470–1547) — document health:**

| Line | Aggregate | Model | Tier | companyId? | Correct? |
|------|-----------|-------|------|------------|----------|
| 1471–1481 | `document.findMany(distinct ownerId)` × 2 | Document | TENANT_OWNED | middleware | ✓ |
| 1504–1547 | `deposit.aggregate` × 3 + `contract.aggregate` × 2 (missing docs) | Deposit / Contract | TENANT_OWNED | middleware | ✓ |

**6-month cashflow trend (lines 1579–1596):**

| Line | Aggregate | Model | Tier | companyId? | Correct? |
|------|-----------|-------|------|------------|----------|
| 1582–1586 | `deposit.aggregate(_sum.amount)` × 6 | Deposit | TENANT_OWNED | middleware | ✓ |
| 1589–1594 | `installment.aggregate(_sum.amount)` × 6 | Installment | TENANT_OWNED | middleware | ✓ |

### 1.14 CSV / XLSX / PDF builders — lines 1655–2248

All methods (`salesCsv`, `salesBoardXlsx`, `financialCsv`, `financialBoardXlsx`, `operationalCsv`, `operationalXlsx`, `financialDashboardCsv`, `financialDashboardXlsx`, `salesPdf`, `financialPdf`, `brokerPdf`) delegate entirely to the primary data methods above. No new queries are issued.

---

## 2. `broker-reports.service.ts`

### Model classification

All models used — `Broker`, `BrokerUser`, `Lead`, `VisitRequest`, `Reservation`, `Contract`, `BrokerCommission`, `BrokerPayout` — are classified `TENANT_OWNED` in `model-tenancy.ts`. No `$queryRaw`. No `User`/`OtpCode`/`CompanyDomain` queries.

### Key methods

| Method | Notable aggregates | Models | Tier | Correct? |
|--------|-------------------|--------|------|----------|
| `summary()` (line 61) | `broker.count` × 2, `brokerUser.count()` | Broker, BrokerUser | TENANT_OWNED | ✓ |
| `aggregateCommonCounts()` (line 993) | `lead.count` × 4, `visitRequest.count`, `reservation.count` × 3, `contract.count` × 2, `contract.aggregate(_sum.totalAmount)`, `brokerCommission.count` × 4, `brokerCommission.aggregate` × 2, `brokerPayout.count` × 4 | all TENANT_OWNED | TENANT_OWNED | ✓ |
| `topBrokers()` (line 122) | Per-broker parallel aggregates via `aggregateCommonCounts` | all TENANT_OWNED | TENANT_OWNED | ✓ |
| `monthlyTrend()` (line 438) | Per-month parallel aggregates + `brokerCommission.aggregate`, `brokerPayout.aggregate` | all TENANT_OWNED | TENANT_OWNED | ✓ |

Note: `brokerUser.count()` (line 88) passes no `where` clause but the Prisma middleware injects `companyId` because `BrokerUser` is `TENANT_OWNED`. Platform-wide count is never returned.

---

## 3. `bonus.module.ts` (BonusService)

### `salesPerformance()` — lines 425–522

| Line | Aggregate | Model | Tier | Correct? |
|------|-----------|-------|------|----------|
| 474–479 | `lead.groupBy(by: ['salesId'])` × 2 | Lead | TENANT_OWNED | ✓ |
| 485–498 | `visitAppointment.groupBy(by: ['salesId'])` × 2 | VisitAppointment | TENANT_OWNED | ✓ |
| 499–513 | `reservation.groupBy(by: ['salesId'])` × 3 | Reservation | TENANT_OWNED | ✓ |
| 517–522 | `contract.findMany` (with bonusEntries) | Contract | TENANT_OWNED | ✓ |
| 474 | `salesTarget.findMany` | SalesTarget | TENANT_OWNED | ✓ |

### `listTargetActors()` — line 731

User query — **V-22, fixed** in commit `4995e95` via `scopedUserFindMany()`. Now carries `companyId` from ALS.

---

## 4. `me-home.module.ts` (MeHomeService)

### `getSummary()` — lines 155–299

| Line | Aggregate | Model | Tier | Correct? |
|------|-----------|-------|------|----------|
| 172 | `findTenantUser(prisma, userId, ...)` | User | TENANT_CONTROLLED | `companyId` injected by helper | ✓ (post-fix) |
| 175–207 | `contract.findFirst`, `contract.count` × 2 | Contract | TENANT_OWNED | ✓ |
| 210–232 | `installment.count` × 3 | Installment | TENANT_OWNED | ✓ |
| 235–252 | `installment.findFirst` × 2 | Installment | TENANT_OWNED | ✓ |
| 256–288 | `maintenanceRequest.count`, `maintenanceRequest.findMany` | MaintenanceRequest | TENANT_OWNED | ✓ |
| 286 | `notification.count` | Notification | TENANT_OWNED | ✓ |
| 294 | `contract.count(pending)` | Contract | TENANT_OWNED | ✓ |

---

## 5. Summary — findings

### Resolved findings (fixed in commit `4995e95`)

| ID | Location | Model | Vulnerability | Fix |
|----|----------|-------|--------------|-----|
| V-25 | `reports.service.ts adminSummary()` | User | `prisma.user.count({ role: CUSTOMER })` — no companyId | `scopedUserCount()` |
| V-26 | `reports.service.ts adminSummary()` | User | `prisma.user.count({ active: true })` — no companyId | `scopedUserCount()` |

### NEW-1, NEW-2, NEW-3 — `$queryRaw` UUID/text type mismatch (production crash)

**Discovered:** 2026-09-15, during execution of the financial isolation security suite (file 04).  
**Fixed:** Same date.

PostgreSQL 16 has no implicit cast from `text` to `uuid`. When Prisma's `$queryRaw` tagged template binds a JavaScript string (bound as `text`), comparing it directly to a `uuid` column produces:

```
ERROR: operator does not exist: uuid = text
Hint: No operator matches the given name and argument types.
Code: 42883
```

The existing working pattern in `units.service.ts:277` correctly uses `${companyId}::uuid`, appending a PostgreSQL type cast as literal SQL. The three failing sites omitted the cast.

| ID | Location | Column type | Fix applied |
|----|----------|-------------|-------------|
| NEW-1 | `reports.service.ts:104` `sales()` | `Contract.companyId uuid` | `${companyId}::uuid` |
| NEW-2 | `reports.service.ts:207` `brokerLeaderboard()` | `BrokerCommission.companyId uuid` | `${companyId}::uuid` |
| NEW-3a | `reports.service.ts:253` `salesTrend()` | `Contract.companyId uuid` | `${companyId}::uuid` |
| NEW-3b | `reports.service.ts:242` `salesTrend()` | `Phase.projectId uuid` | `${projectId}::uuid` (latent — only fires when projectId is supplied) |

**Scoping verdict:** No cross-tenant data leak. The crash occurs before any rows are returned; the companyId filter itself was correctly sourced from `getRequiredCompanyId()` in all cases. The bug was type safety, not tenant isolation.

**Whole-API scan:** `grep -rn '= \${.*[Ii]d.*}[^:]' src/ | grep -v '::uuid\|::text\|spec\|new Date'` returned exactly these four sites. No other `$queryRaw` blocks in the API compare a UUID column without a cast.

---

## 6. Coverage gap — endpoints that crashed unconditionally

**Finding:** `GET /v1/reports/sales`, `GET /v1/reports/sales-trend`, and `GET /v1/reports/broker-leaderboard` (which all route to the three crashing methods) returned HTTP 500 for every request in every environment since they were written. Nothing caught it before the financial isolation security suite.

### Which test suites should have caught this

| Suite | Why it didn't catch the crash |
|-------|-------------------------------|
| Unit suite (`reports.service.ts` unit spec) | The unit specs mock `this.prisma.$queryRaw` and never execute real SQL. A mocked `$queryRaw` returns whatever the mock returns regardless of the SQL content — the type mismatch only surfaces against a real PostgreSQL connection. |
| `reports-permissions.spec.ts` (security) | Tests only that the correct HTTP status codes are returned for different roles. It does not assert `200` for authenticated admin requests — it only tests `401`/`403` paths. |
| `reports-csv-export.spec.ts`, `reports-xlsx-binary.spec.ts`, `reports-board-fallback.spec.ts` | These test specific export paths and board-fallback logic, but none of them call `GET /v1/reports/sales`, `sales-trend`, or `broker-leaderboard`. |
| Flow-e e2e (`test/e2e/`) | No e2e test exercises the sales report or broker-leaderboard endpoints. |

### Gap to close

The unit specs for `reports.service.ts` must add at least one happy-path test per `$queryRaw` method (`sales`, `salesTrend`, `brokerLeaderboard`) that asserts `expect(status).toBe(200)` against a real or in-memory database. Without executing real SQL, mocked unit tests cannot catch `42883`-class errors.

Alternatively, the security e2e suite (which now runs against a real Postgres) provides the coverage through `04-financial-isolation.security-spec.ts` — FI-3 and FI-3b now exercise `GET /v1/reports/sales` end-to-end. The CI `api-security` job will catch any future regression.

---

## 7. Financial isolation proof

See `apps/api/test/security/04-financial-isolation.security-spec.ts`.

The test seeds two companies (A and B) with different known deposit/installment/contract/bonus amounts, calls every financial aggregate endpoint as Company A's ADMIN, and asserts each returned total exactly matches Company A's seeded amounts. Any divergence (i.e., a total that includes Company B's data) would be flagged as a failing test.

**Final result (2026-09-15):** 115/115 tests pass. All financial aggregates are correctly scoped.

Three-number table for the previously-failing tests after the `::uuid` fix:

| Test | Endpoint field | API value | rawPrisma CoA | platform A+B | Result |
|------|---------------|-----------|---------------|--------------|--------|
| FI-3 | `sales.contracts` | 1 | 1 | 4 | **PASS** |
| FI-3b | `sales.total` | 1,500,000 | 1,500,000 | 3,700,000 | **PASS** |
| FI-5 | `kpis.totalCustomers` | 1 | 1 | 4 | **PASS** |
| FI-5b | `kpis.totalTeam` | 4 | 4 | 14 | **PASS** |

---

## 8. Test counts (final)

| Suite | Count |
|-------|-------|
| Unit (`pnpm --filter @rep/api test`) | 2008 |
| Security e2e (`jest-security.json`) | 115 (files 01–04) |

The 5 regression tests for V-20..V-26 are in the unit suite. The 12 financial isolation tests are in the security e2e suite (file 04).
