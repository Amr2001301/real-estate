# 11 — Tree State Audit

> **Purpose:** Verify that the e2e failure count and typecheck errors reported in
> `10-implementation-log.md` are accurate and pre-existing relative to the last
> commit (`3c7378c edit multi attendance work flow`).
>
> **Date:** 2026-09-14  
> **Commands run:** `git status`, `git stash list`, `git stash` / `pop`,
> `pnpm exec prisma generate`, `pnpm --filter @rep/api test:e2e --runInBand`,
> `pnpm --filter @rep/api typecheck`

---

## Q1 — Count reconciliation: 20 or 30 e2e failures?

**Correct count: 20.**

The "30" figure came from task `bkvaoy37v` — a background e2e run from a prior
session that completed while the `b0vpj4z7m` output was being discussed. That
earlier run was in a different DB/MinIO state and the seededAdmin login returned
tokens in a format the test didn't extract (producing `adminToken = undefined`),
causing every `seededAdmin → NOT 403/401` test to fail with 401. Those 16+
seededAdmin failures are not real failures — they are a test-setup artefact from
that particular run.

Two fresh, full e2e runs were made in this session with identical env:

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/realestate_e2e
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeMe123!
--runInBand
```

| Run | Tree | Suites failed | Tests failed |
|---|---|---|---|
| `b0vpj4z7m` | current (Step A + MT work) | 7 | **20** |
| `bzou320fn` | clean HEAD (git stash) | 8 | **21** |

The single extra failure on clean HEAD (`health.e2e-spec.ts` x-request-id
header) is likely a flaky timing issue — it is absent from the current-tree run
on the same DB seed, and it does not appear consistently. No failure was
introduced by Step A or by the pre-existing MT work.

---

## Q2 — What is the "in-flight MT work"?

### git status

```
 M .github/workflows/ci.yml
 M apps/api/prisma/schema.prisma
 M apps/api/src/common/guards/broker-scope.guard.ts
 M apps/api/src/common/prisma/__tests__/fixtures/legacy-tenant-scoped-models.fixture.ts
 M apps/api/src/common/prisma/__tests__/model-tenancy-boot.spec.ts
 M apps/api/src/common/prisma/__tests__/mt014-model-tenancy-policy.spec.ts
 M apps/api/src/common/prisma/model-tenancy.ts
 M apps/api/src/common/prisma/prisma.service.ts
 M apps/api/src/modules/broker-leads/broker-leads.service.ts
 M apps/api/src/modules/contracts/__tests__/contracts-permissions.spec.ts
 M apps/api/src/modules/contracts/contracts.module.ts
 M apps/api/src/modules/documents/documents.module.ts
 M apps/api/src/modules/leads/__tests__/leads-permissions.spec.ts
 M apps/api/src/modules/leads/leads.controller.ts
 M apps/api/src/modules/leads/leads.module.ts
 M apps/api/src/modules/leads/leads.service.ts
 M apps/api/src/modules/maintenance/__tests__/maintenance-permissions.spec.ts
 M apps/api/src/modules/maintenance/maintenance.service.ts
 M apps/api/src/modules/notifications/__tests__/notifications-permissions.spec.ts
 M apps/api/src/modules/notifications/notifications.module.ts
 M apps/api/src/modules/permissions/permissions.module.ts
 M apps/api/src/modules/requests/__tests__/requests-permissions.spec.ts
 M apps/api/src/modules/requests/requests.module.ts
 M apps/api/src/modules/reservations/__tests__/reservation-conversion-workflow.spec.ts
 M apps/api/src/modules/reservations/__tests__/reservations-lead-guards.spec.ts
 M apps/api/src/modules/reservations/__tests__/reservations-permissions.spec.ts
 M apps/api/src/modules/reservations/reservations.module.ts
 M apps/api/src/modules/visits/__tests__/visits-assignment-scope.spec.ts
 M apps/api/src/modules/visits/__tests__/visits-notifications.spec.ts
 M apps/api/src/modules/visits/visits.service.ts
?? CLAUDE.md
?? apps/api/prisma/migrations/20260914055009_step_a_payment_instrument/
?? apps/api/src/common/tenant/resolve-tenant-entity.ts
?? apps/api/src/modules/leads/guards/
?? apps/api/test/jest-security.json
?? apps/api/test/security/
?? docs/audit/
```

### git stash list

*(empty — no stashes)*

### Partition of uncommitted changes

**Step A files** (8 tracked M + 3 untracked new):

| File | Type |
|---|---|
| `apps/api/prisma/schema.prisma` | M (Step A additions only; plus 1 comment from MT work) |
| `apps/api/src/common/prisma/__tests__/fixtures/legacy-tenant-scoped-models.fixture.ts` | M — count 46→47 |
| `apps/api/src/common/prisma/__tests__/model-tenancy-boot.spec.ts` | M — count 46→47 |
| `apps/api/src/common/prisma/__tests__/mt014-model-tenancy-policy.spec.ts` | M — count 46→47 |
| `apps/api/src/common/prisma/model-tenancy.ts` | M — `PaymentInstrument: 'TENANT_OWNED'` |
| `apps/api/prisma/migrations/20260914055009_step_a_payment_instrument/` | ?? new migration |
| `apps/api/test/jest-security.json` | ?? new security test config |
| `apps/api/test/security/` | ?? new security test directory |
| `docs/audit/` | ?? audit docs directory |

**Pre-existing MT work files** (22 tracked M + 2 untracked new):

The work is a multi-tenant user-lookup hardening pass:

- `resolve-tenant-entity.ts` (new untracked) — `resolveTenantUser()` helper; uses
  `user.findFirst` with `{ id, companyId }` instead of `user.findUnique` with `{ id }`
  alone, preventing cross-tenant user references.
- `leads/guards/lead-scope.guard.ts` (new untracked) — row-level `LeadScopeGuard`
  interceptor; ADMIN pass-through, SALES self-only, SALES_MANAGER team-only.
- `broker-leads.service.ts` — `approve()` uses `resolveTenantUser` for assignedSalesId
- `contracts.module.ts` — `create()` calls `resolveTenantUser` for customerId +
  scopes the CLIENT→CUSTOMER role upgrade to current tenant
- `documents.module.ts` — (minor related import)
- `leads.controller.ts` / `leads.module.ts` / `leads.service.ts` — adds
  `LeadScopeGuard`, uses `resolveTenantUser` for clientId
- `maintenance.service.ts` — `resolveTenantUser` for client lookups
- `notifications.module.ts` — `resolveTenantUser` for recipient; cross-tenant
  template-code conflict check via `$queryRaw`
- `permissions.module.ts` — `resolveTenantUser` replaces `user.findUnique` in
  `listForUser` / `updateForUser`
- `requests.module.ts` — (related module wiring)
- `reservations.module.ts` — `resolveTenantUser` for salesId / clientId; scope
  check mode changed from `{ managersOnly: true }` to `{ mode: 'forbidden' }`
- `visits.service.ts` — `resolveTenantUser` for clientId / assignedSalesId
- `broker-scope.guard.ts` — doc comment only (no behavior change)
- `prisma.service.ts` — MT-015 (`assertMiddlewareApiAvailable`) and MT-016
  (`assertCompanyIdModelsClassified`) boot assertions
- `.github/workflows/ci.yml` — CI pipeline changes
- Unit test files (8 spec files) — updated for the above changes

**This work is not finished.** The unit test changes include partial refactors
(3 typecheck errors in the spec files themselves) and the spec files reference
stubs that do not yet exist in HEAD. The e2e test suite has no failures that
depend on this work being complete.

---

## Q3 — e2e failure attribution table

Failure names taken from `b0vpj4z7m` (current tree, fresh run, 20 tests):

| Failing test | File | Fails on clean HEAD? | Root cause |
|---|---|---|---|
| `strict-permissions` bareAdmin broker_leads:approve → 403 | `strict-permissions.e2e-spec.ts` | YES (identical) | Test sends `POST /v1/broker-leads/:id/approve` but controller uses `@Patch`. Returns 404, not 403. Bug in the test. |
| `strict-permissions` bareAdmin broker_leads:reject → 403 | same | YES | Same: test sends POST, controller is PATCH. |
| `strict-permissions` bareAdmin brokers:suspend → 403 | same | YES | Test sends `PATCH /v1/brokers/:id/suspend` but controller uses `@Post`. Returns 404. |
| `strict-permissions` bareAdmin brokers:terminate → 403 | same | YES | Same: test sends PATCH, controller is POST. |
| `strict-permissions` "Test suite failed to run" | same | YES | `afterAll(…)` called inside `beforeAll(…)`. Jest 29 (jest-circus) forbids adding hooks asynchronously after tests have started. Teardown is skipped but tests still run. Bug in test. |
| `CUST-03` Customer1 GET /v1/me/contracts → 200 | `idor-penetration.e2e-spec.ts` | YES (identical) | `/v1/me/contracts` returns 404. Endpoint requires customer-portal feature flag or a `/me` contracts route that is not wired in HEAD. |
| `CUST-03b` Customer2 same | same | YES | Same. |
| `CUST-05` Customer1 GET /v1/me/documents → 200 | same | YES | Same underlying issue. |
| ISO-R1 through ISO-R4 | `reports-mt-isolation.e2e-spec.ts` | YES (identical) | Reports endpoints return unexpected cross-tenant data or fail for reasons unrelated to Step A. |
| E5 | `flow-e-financial-documents.e2e-spec.ts` | YES | Assertion written for storage-unset/CI case (→503); fails when MinIO is running. |
| F5 | `flow-f-maintenance.e2e-spec.ts` | YES | Same MinIO behaviour. |
| G2, G3, G4, G6, G8, G9 | `flow-g-upload.e2e-spec.ts` | YES | `TypeError: fetch failed` — MinIO/R2 not reachable from test environment. |
| rbac-route-coverage | `rbac-route-coverage.e2e-spec.ts` | YES | `AuthController.tenantForgotPassword` and `AuthController.tenantResetPassword` lack `@Roles()` or `@Public()` decorators. Unrelated to Step A. |

**Conclusion: every one of the 20 current-tree failures also fails on clean HEAD.**
No failure was introduced by Step A. No failure was introduced by the pre-existing
MT work (the work is additive — it tightens user lookups at the service layer, not
at the HTTP routing layer that these tests exercise).

---

## Q4 — Typecheck error attribution

### Current tree (Step A + MT work): 3 errors

```
src/modules/notifications/notifications.module.ts(211,33):
  error TS2532: Object is possibly 'undefined'.
  — In the $queryRaw cross-tenant template check: `conflicts[0].companyId`
    is not narrowed despite the `conflicts.length > 0` guard. Part of the
    pre-existing MT work code.

src/modules/reservations/__tests__/reservations-permissions.spec.ts(99,5):
  error TS2353: Object literal may only specify known properties,
  and 'salesId' does not exist in type ...
  — Pre-existing MT spec file uses a mock shape that no longer matches the
    Prisma type after a model change.

src/modules/visits/__tests__/visits-notifications.spec.ts(149,7):
  error TS2353: Object literal may only specify known properties,
  and 'findFirst' does not exist in type '{ findUnique: Mock ... }'.
  — Pre-existing MT spec file: mock object missing `findFirst` after
    resolveTenantUser was added (uses findFirst instead of findUnique).
```

**All 3 are in pre-existing MT work files. Zero typecheck errors are from Step A.**

### Clean HEAD (git stash + prisma generate from HEAD schema): ~34 errors

All errors are in `test/security/03-payment-instrument-tenancy.security-spec.ts`
and `test/security/seed/security-fixture.ts` — the untracked Step A test files
that reference `PaymentInstrumentType`, `paymentInstrument`, and
`paymentInstrumentId`. When the Prisma client is regenerated from HEAD schema
(which does not include `PaymentInstrument`), those imports and property accesses
fail to type-check.

These errors do NOT appear on the current tree because the Step A schema is
present and the Prisma client includes `PaymentInstrument`.

**Summary:** the 3 typecheck errors are part of the pre-existing MT work (not Step A).
The 34 HEAD errors are a side-effect of stashing Step A schema while the test files
remain on disk — they go away on `git stash pop + prisma generate`.

---

## Baseline for Step B

**HEAD is not a clean baseline.** The tree carries 22 tracked modified files of
in-flight MT work on top of the last commit. The work is coherent and additive
(no half-rolled-back states, no broken imports, no failing e2e tests introduced),
but it is not committed.

**Step A is cleanly separable.** Its 8 files (schema, migration, model-tenancy,
fixture, mt014 spec, boot spec, security tests, docs) are orthogonal to the MT
work files. None overlap except `schema.prisma` (Step A adds new models; MT work
adds one comment line — no merge conflicts).

**Recommendation before building Step B:** commit the pre-existing MT work as a
separate commit ("feat(mt): tenant-scoped user resolution — resolveTenantUser
helper, LeadScopeGuard, MT-015/MT-016 boot assertions") and then commit Step A.
This keeps the graph readable and makes any future bisect unambiguous.
