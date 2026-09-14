# Fix Log — VULN-1 through VULN-4

## STEP 1 — Exhaustive body-supplied FK lookup table

Scope of search: all `prisma.user.findUnique`, `prisma.user.findFirst`, and `tx.user.*`
on the TENANT_CONTROLLED `User` model whose `where` clause contains a body-/param-supplied
id and lacks a `companyId` filter.  TENANT_OWNED models (Unit, Lead, Contract, Broker, etc.)
are auto-scoped by the Prisma middleware and are excluded from this table.

| # | File:Line | Model | DTO/Param field | Verdict |
|---|---|---|---|---|
| V-01 | `apps/api/src/modules/reservations/reservations.module.ts:373` | User | `dto.salesId` | **VULNERABLE** — SALES user resolved cross-tenant |
| V-02 | `apps/api/src/modules/reservations/reservations.module.ts:396` | User | `dto.clientId` | **VULNERABLE** — CLIENT user resolved cross-tenant |
| V-03 | `apps/api/src/modules/reservations/reservations.module.ts:1418` | User | `dto.salesId` (update path) | **VULNERABLE** — SALES user resolved cross-tenant |
| V-04 | `apps/api/src/modules/visits/visits.service.ts:382` | User | `dto.assignedSalesId` (in-tx display) | **VULNERABLE** — user from another tenant referenced |
| V-05 | `apps/api/src/modules/visits/visits.service.ts:451` | User | `dto.clientId` | **VULNERABLE** — CLIENT user resolved cross-tenant |
| V-06 | `apps/api/src/modules/visits/visits.service.ts:739` | User | `salesId` (from `dto.assignedSalesId`) | **VULNERABLE** — SALES resolved cross-tenant |
| V-07 | `apps/api/src/modules/visits/visits.service.ts:1037` | User | `dto.assignedSalesId` (reassign) | **VULNERABLE** — sales reassign cross-tenant |
| V-08 | `apps/api/src/modules/broker-leads/broker-leads.service.ts:122` | User | `dto.assignedSalesId` (approve) | **VULNERABLE** — SALES resolved cross-tenant |
| V-09 | `apps/api/src/modules/leads/leads.service.ts:117` | User | `dto.clientId` (in-tx create) | **VULNERABLE** — CLIENT user resolved cross-tenant |
| V-10 | `apps/api/src/modules/contracts/contracts.module.ts:354` | User (updateMany write) | `dto.customerId` | **VULNERABLE** — write promotes user from another tenant |
| V-11 | `apps/api/src/modules/maintenance/maintenance.service.ts:373` | User | `customerId` (path param) | **VULNERABLE** — customer units for cross-tenant user |
| V-12 | `apps/api/src/modules/maintenance/maintenance.service.ts:508` | User | `dto.customerId` | **VULNERABLE** — customer resolved cross-tenant |
| V-13 | `apps/api/src/modules/maintenance/maintenance.service.ts:674` | User | `userId` (from `dto.assignedAdminId`) | **VULNERABLE** — staff resolved cross-tenant |
| V-14 | `apps/api/src/modules/permissions/permissions.module.ts:73` | User | `userId` (path param) | **VULNERABLE** — user permissions readable cross-tenant |
| V-15 | `apps/api/src/modules/permissions/permissions.module.ts:111` | User | `userId` (path param) | **VULNERABLE** — permission assignment cross-tenant |
| V-16 | `apps/api/src/modules/documents/documents.module.ts:407` | User | `ownerId` (dto, ownerType=USER) | **VULNERABLE** — doc linked to cross-tenant user |
| V-17 | `apps/api/src/modules/notifications/notifications.module.ts:312` | User | `dto.userId` (best-effort push) | **VULNERABLE** — notification sent to cross-tenant user |

Sites reviewed and found **NOT vulnerable** (already have companyId or model is TENANT_OWNED / auto-scoped):

- `reservations.module.ts:956` — userId = actor.sub (own id, not body-supplied)
- `reservations.module.ts:982` — lookup by email for contact dedup, not by id from body
- `reservations.module.ts:415,457,616,685,690` — Lead / Unit (TENANT_OWNED, auto-scoped)
- `users.service.ts:110` — `findFirst({ where: { id, companyId } })` already scoped
- `users.service.ts:157,300,336` — all include `companyId` in where
- `users.service.ts:257` — id = actor.sub from JWT, not body-supplied
- `broker-reservations.service.ts:159,171` — Broker / BrokerUser (TENANT_OWNED, auto-scoped)
- `broker-payouts.service.ts:205` — Broker (TENANT_OWNED, auto-scoped)
- `deposits.service.ts:153,189,464,563` — Contract / Installment (TENANT_OWNED, auto-scoped)
- `contracts.module.ts:329,369` — Unit (TENANT_OWNED, auto-scoped)
- `visits.service.ts:468,478,485` — Lead / Project / Unit (TENANT_OWNED, auto-scoped)
- `broker-portal-*.service.ts` — TENANT_OWNED models + explicit brokerId scope
- `documents.module.ts:398,401,404` — Broker / BrokerCommission / BrokerPayout (TENANT_OWNED)
- `installments.module.ts:147` — Contract (TENANT_OWNED, auto-scoped)
- `requests.module.ts:245,251,401,406` — Project / Unit (TENANT_OWNED, auto-scoped)

---

## STEP 1 — File change log

| File | What changed | Tests now passing |
|---|---|---|
| `apps/api/src/common/tenant/resolve-tenant-entity.ts` | NEW — `resolveTenantUser()` helper: resolves User by id+companyId from ALS, throws NotFoundException, accepts expectRoles option, safe in $transaction | V-01…V-17 |
| `apps/api/src/modules/reservations/reservations.module.ts` | V-01: salesId lookup → resolveTenantUser (expectRoles SALES) | F1-3 |
| `apps/api/src/modules/reservations/reservations.module.ts` | V-02: clientId lookup → resolveTenantUser (expectRoles CLIENT,CUSTOMER) | F1-1 |
| `apps/api/src/modules/reservations/reservations.module.ts` | V-03: update salesId lookup → resolveTenantUser (expectRoles SALES) | — |
| `apps/api/src/modules/visits/visits.service.ts` | V-04,05,06,07: all user lookups → resolveTenantUser | — |
| `apps/api/src/modules/broker-leads/broker-leads.service.ts` | V-08: assignedSalesId → resolveTenantUser (expectRoles SALES,ADMIN) | — |
| `apps/api/src/modules/leads/leads.service.ts` | V-09: clientId → resolveTenantUser in resolveClient | — |
| `apps/api/src/modules/contracts/contracts.module.ts` | V-10: customerId updateMany → add companyId to where via resolveTenantUser pre-validation | — |
| `apps/api/src/modules/maintenance/maintenance.service.ts` | V-11,12,13: all user lookups → resolveTenantUser | — |
| `apps/api/src/modules/permissions/permissions.module.ts` | V-14,15: userId lookups → resolveTenantUser | — |
| `apps/api/src/modules/documents/documents.module.ts` | V-16: ownerId (USER type) → resolveTenantUser | — |
| `apps/api/src/modules/notifications/notifications.module.ts` | V-17: userId best-effort → resolveTenantUser | — |

---

## STEP 2 — VULN-2: SALES row-level scope bypass

### Root cause

`assertSalesRecordInScope` (sales-scope.ts:130) has a `managersOnly` option designed for callers that handle SALES ownership separately. Both `assertLeadInScope` (leads.controller.ts) and `assertReservationInScope` (reservations.module.ts) passed `managersOnly: true` without implementing any SALES self-check of their own, causing SALES to skip ownership enforcement entirely and read/write any lead or reservation in their tenant.

**Bug location: call sites, not the helper.** The helper's contract is correct; the callers misused it.

### Scope check: reservations, visits, contracts, deposits

| Module | Status |
|---|---|
| Reservations | **SAME BUG** — `assertReservationInScope` also passed `managersOnly: true`; fixed same way |
| Contracts | Not vulnerable — calls `assertSalesRecordInScope` without `managersOnly` |
| Visits | Not vulnerable — does not use `assertSalesRecordInScope` |
| Deposits | Not vulnerable — does not use `assertSalesRecordInScope` |

### Implementation note

The fix removes `managersOnly: true` and adds `mode: 'forbidden'`. For leads, the scope check was additionally promoted from a route-handler call to a **route-level NestJS interceptor** (`LeadScopeGuard`). This was required because the `ValidationPipe` with `forbidNonWhitelisted: true` runs at pipe phase (after interceptors), so a handler-level check on PATCH routes would never fire for bodies containing unknown fields — the pipe would return 400 first. By running as an interceptor (after `TenantContextInterceptor` sets ALS context, before pipes), the scope check fires first and returns 403 correctly.

### File change log

| File | What changed | Tests now passing |
|---|---|---|
| `apps/api/src/modules/leads/guards/lead-scope.guard.ts` | NEW — `LeadScopeGuard` interceptor: checks lead assignedSalesId scope before ValidationPipe runs; ADMIN bypasses, SALES must own, SALES_MANAGER must be in team | F3-2, F3-3 |
| `apps/api/src/modules/leads/leads.module.ts` | Added `LeadScopeGuard` to providers | — |
| `apps/api/src/modules/leads/leads.controller.ts` | Replaced in-handler `assertLeadInScope` calls with `@UseInterceptors(LeadScopeGuard)` on GET/:id, PATCH/:id, PATCH/:id/stage, POST/:id/notes | F3-2, F3-3 |
| `apps/api/src/modules/reservations/reservations.module.ts` | `assertReservationInScope` — removed `managersOnly: true`, added `mode: 'forbidden'`; SALES now checked for `salesId === self` | — |
| `apps/api/src/modules/leads/__tests__/leads-permissions.spec.ts` | Mock lead now has `assignedSalesId: 'sales-1'` so SALES permission tests pass scope check | — |
| `apps/api/src/modules/reservations/__tests__/reservations-permissions.spec.ts` | Mock reservation now has `salesId: 'sales-1'` so SALES note test passes scope check | — |

---

## STEP 3 — Guards against future tenant-scoping regressions

Two new boot assertions + accompanying unit tests protect against:
1. A Prisma major-version upgrade silently removing `$use` and disabling tenant middleware
2. A developer adding a new model with a `companyId` column without classifying it as TENANT_OWNED or TENANT_CONTROLLED

### assertMiddlewareApiAvailable (MT-015)
Checks `typeof this.$use === 'function'` at startup. Throws `[MT-015]` with an actionable migration message if `$use` is removed by a Prisma upgrade. Called at the top of `onModuleInit` so the application cannot start without the middleware API present.

### assertCompanyIdModelsClassified (MT-016)
Iterates all DMMF models at startup. Any model with a **required** (non-nullable) `companyId` field must be classified as `TENANT_OWNED` or `TENANT_CONTROLLED`. Nullable `companyId?` fields are exempted (cross-tenant references like `PricingPackage.companyId?`). Throws `[MT-016]` naming all violators.

### File change log

| File | What changed | Tests now passing |
|---|---|---|
| `apps/api/src/common/prisma/prisma.service.ts` | Added `assertMiddlewareApiAvailable` (MT-015) + `assertCompanyIdModelsClassified` (MT-016); both called in `onModuleInit` | — |
| `apps/api/src/common/prisma/__tests__/model-tenancy-boot.spec.ts` | Added MT-015 (×2 tests) and MT-016 (×3 tests) test blocks | — |

---

## STEP 4 — File change log

| File | What changed | Tests now passing |
|---|---|---|
| `apps/api/src/modules/requests/requests.module.ts` | GET /info-requests: added `@Permissions('visits:read')` — was role-only; now requires explicit grant | requests-permissions (15/15) |
| `apps/api/src/modules/requests/__tests__/requests-permissions.spec.ts` | Rewrote GET /info-requests describe block: SALES without visits:read → 403, SALES with visits:read → 200 | requests-permissions (15/15) |
| `apps/api/src/modules/notifications/notifications.module.ts` | `upsertTemplate` made async; added `$queryRaw` pre-check so Company A cannot overwrite Company B's template via the global unique `code` constraint | — |

### NotificationTemplate.code migration (DEFERRED — no schema change this phase)

`NotificationTemplate` has a global UNIQUE constraint on `code`. One company can overwrite another's template by calling `upsertTemplate` with the same code value. The service-layer guard added in STEP 4 prevents this without a schema migration. The correct long-term fix is:

```sql
-- Required follow-up migration (do NOT run in this phase):
ALTER TABLE "NotificationTemplate" DROP CONSTRAINT "NotificationTemplate_code_key";
CREATE UNIQUE INDEX "NotificationTemplate_code_companyId_key"
  ON "NotificationTemplate"("code", "companyId");
```

This migration requires a data-integrity pass first (deduplicate rows where the same code appears under multiple companies) and must be coordinated with the seeder.
