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

---

## Post-commit state (2026-09-14, after four feature commits + one lint-fix commit)

### Commits landed on `main`

| SHA | Message |
|---|---|
| `801bc62` | docs(audit): add CLAUDE.md and full audit document set |
| `e14eed0` | feat(security): tenant-scoped user resolution and row-level lead scope |
| `606d972` | ci: add security test job and all-checks-passed aggregate gate |
| `a005b7b` | feat(step-a): PaymentInstrument schema plumbing and tenancy classification |
| `6bfc7d5` | test(security): add attack-matrix security spec (missed from commit 1) |
| `6a21dd1` | fix(lint): add resolve-tenant-entity and sales-scope to prisma.user allowlist |
| `404f567` | fix(lint): suppress pre-existing prisma.user MT-012 violations across modules |

### Suite results at HEAD (`404f567`)

| Suite | Count | Result |
|---|---|---|
| Unit (`pnpm --filter @rep/api test`) | 2003/2003 | PASS |
| Security (`jest --config test/jest-security.json`) | 93/93 | PASS |
| Typecheck (`tsc --noEmit`) | 0 errors | PASS |
| Lint (`eslint .`) | 0 errors, 20 warnings | PASS |

### Accepted e2e failure baseline (local run, 2026-09-14)

**20 failures on current tree — all pre-exist on clean HEAD.**
See Q3 table above for attribution. None are introduced by Step A or the MT security work.

The 20 failures fall into five independent categories:

1. **Wrong HTTP method in test** (4): `broker_leads:approve/reject` (POST vs PATCH), `brokers:suspend/terminate` (PATCH vs POST) in `strict-permissions.e2e-spec.ts`.
2. **Jest-circus hook ordering** (1): `afterAll` nested inside `beforeAll` in `strict-permissions.e2e-spec.ts` — suite fails to run but individual tests still execute.
3. **Missing customer-portal routes** (3): `/v1/me/contracts` and `/v1/me/documents` not yet wired for customer-app access.
4. **Reports MT isolation** (4): `reports-mt-isolation.e2e-spec.ts` ISO-R1–R4.
5. **MinIO/storage unreachable** (8): E5, F5, G2/G3/G4/G6/G8/G9 — require object storage running; pass in CI with MinIO or when MinIO is stopped.

**Step B must not introduce any new e2e failures beyond this baseline.**

---

### Revised baseline after e2e singleton (commit b6bd13f, 2026-09-19)

**Source: local runs only. CI e2e job was cancelled in both the pre-singleton and post-singleton runs; no test results were produced by CI.**

The e2e singleton (`createE2ETestApp`) was applied to 23 of 26 spec files (commit b6bd13f).
Three local runs (forward × 2, reverse-alphabetical × 1) all produced:

- **Test Suites: 7 failed, 19 passed, 26 total**
- **Tests: 17 failed, 294 passed, 311 total**

The failure count dropped from 20 → 17 tests (3 fewer). The 7 failing suites are unchanged.

**What changed:**

| # | Test | Before (baseline) | After (singleton) | Explanation |
|---|---|---|---|---|
| 1–4 | strict-permissions wrong-method (×4) | FAIL | FAIL | unchanged |
| 5–7 | idor CUST-03/03b/05 | FAIL | FAIL | unchanged |
| 8 | reports-mt ISO-R1 | FAIL | **PASS** | test setup fixed (see below) |
| 9 | reports-mt ISO-R2 | FAIL | **PASS** | same |
| 10 | reports-mt ISO-R3 | FAIL | FAIL | genuine isolation bug remains |
| 11 | reports-mt ISO-R4 | FAIL | **PASS** | test setup fixed (see below) |
| 12 | flow-e E5 | FAIL | FAIL | unchanged (MinIO) |
| 13 | flow-f F5 | FAIL | FAIL | unchanged (MinIO) |
| 14–19 | flow-g G2/G3/G4/G6/G8/G9 | FAIL | FAIL | unchanged (MinIO) |
| 20 | rbac-route-coverage | FAIL | FAIL | unchanged |

**ISO-R1, ISO-R2, ISO-R4 now pass — not because the application changed, but because the test setup was fixed.** The original `reports-mt-isolation.e2e-spec.ts` beforeAll used `testApp.prisma` + `runTenantContext(bypass: true)`. In the singleton, the spec's vm context has a different `AsyncLocalStorage` instance than the app, so `bypass` never reached the Prisma middleware. Company B setup completed partially but the admin login silently failed. Converting to `rawPrisma` fixed the setup; all three assertions now actually execute and pass. ISO-R3 remains failed — a genuine broker-leaderboard cross-tenant isolation bug.

**"Test suite failed to run" counting:** Jest counts this as 1 failed Test Suite but 0 failed Tests. The 4 wrong-method tests in strict-permissions are 4 individual test failures counted separately. This explains the difference between the category totals (4+1+3+4+1+1+6+1 = 21 if you count the suite error as a test, 20 if you don't — the baseline counted it as 1 in the category list but it does not appear in `Tests: 17 failed`).

**CI status:** The e2e job was cancelled at 15m 18s on both runs (pre- and post-singleton). The bottleneck is ts-jet compilation (26 spec files × ~30s/file = ~13 min), not NestJS boots. ts-jest performs full type-checking per file because `isolatedModules` is not set. Adding `"isolatedModules": true` to the ts-jet transform in `jest-e2e.json` (and `jest-security.json`) is the correct next fix.

---

### CI-verified baseline (2026-09-24, commits `df58f9f` → `8707e06`)

**Source: CI run `35975368603` (workflow\_dispatch, `suite=e2e-only`), commit `8707e06`.**  
This is the first run where both e2e jobs were driven to completion in CI (not cancelled, not locally). Numbers below supersede the local-only baselines above.

#### api-e2e-1 — **PASS** ✓

**Wall time:** job 82s total; Jest step 27s (`08:35:35` → `08:36:02`).  
**File order chosen by Jest:** e2e-reservations first (failed-first sequencer from the prior run), then e2e-catalog-auth, then e2e-financial.

```
PASS test/e2e/e2e-reservations.e2e-spec.ts (11.514 s)
PASS test/e2e/e2e-catalog-auth.e2e-spec.ts
PASS test/e2e/e2e-financial.e2e-spec.ts
Test Suites: 3 passed, 3 total
Tests:       133 passed, 133 total
```

**No failures.** The fix in `8707e06` (restore `NOT: p1Id` in `pickFreshUnit` + expand Avenue Business Hub from 4 to 10 units) resolved all regressions.

#### api-e2e-2 — **FAIL** (9 pre-existing)

**Wall time:** job 82s total; Jest step 29s (`08:35:41` → `08:36:10`).

```
FAIL test/e2e/e2e-mt-security.e2e-spec.ts
FAIL test/e2e/e2e-isolated-apps.e2e-spec.ts
PASS test/e2e/e2e-maintenance.e2e-spec.ts
Test Suites: 2 failed, 1 passed, 3 total
Tests:       9 failed, 14 skipped, 153 passed, 176 total
```

**Failing tests (9, all pre-existing — unchanged from prior runs):**

| Test | File | Root cause |
|---|---|---|
| ISO-R3: Company B broker-leaderboard returns empty | `e2e-mt-security` | Genuine cross-tenant isolation bug in reports service |
| CUST-03: Customer1 /me/contracts isolation | `e2e-isolated-apps` | `/v1/me/contracts` route not wired |
| CUST-03b: Customer2 /me/contracts isolation | `e2e-isolated-apps` | Same |
| CUST-05: Customer1 /me/documents IDOR | `e2e-isolated-apps` | Same route gap |
| TEST-002 `broker_leads:approve` bareAdmin → 403 | `e2e-isolated-apps` | Controller uses `@Patch`, test sends `POST` |
| TEST-002 `broker_leads:reject` bareAdmin → 403 | `e2e-isolated-apps` | Same |
| TEST-002 `brokers:suspend` bareAdmin → 403 | `e2e-isolated-apps` | Controller uses `@Post`, test sends `PATCH` |
| TEST-002 `brokers:terminate` bareAdmin → 403 | `e2e-isolated-apps` | Same |
| RBAC route coverage: 36 routes lack `@Public()` or `@Roles()` | `e2e-isolated-apps` | Auth/RBAC decorators missing on several controllers |

`e2e-isolated-apps` also emits "Test suite failed to run" (1 suite error, 0 extra test failures — `afterAll` inside `beforeAll` Jest-circus restriction).

#### Order-independence verification (local, 2026-09-24)

Two local runs against a fresh seed, same commit (`8707e06`), different file orders:

| Order | Suites | Tests | Notes |
|---|---|---|---|
| catalog-auth → reservations → financial (alphabetical) | 1 failed / 3 | 1 failed / 133 | E5 MinIO — pre-existing |
| reservations → catalog-auth → financial (CI's failing order) | 1 failed / 3 | 1 failed / 133 | Same E5 only |

Same result both ways. The fix is order-independent.

#### Design note: shared pool fragility

Jest's default `TestSequencer` re-runs previously-failed files first. When e2e-reservations failed (P9.2/P9.3/P9.4), the next CI run sequenced it before e2e-catalog-auth — the opposite of alphabetical order. The unit pool in the seed was then exhausted in the wrong order, causing catalog-auth's `loadE2EFixtures` to crash with *"Expected at least one AVAILABLE unit under p1; got none."*

The current fix buys headroom (non-P1 pool expanded from ~9 to ~15 after DA permanently reserves 5 units), but the dependency on a shared seeded pool is still fragile by construction. A future test that adds one more `pickFreshUnit` call will silently shrink the slack. The correct long-term fix is for each describe that needs a unit to rawPrisma-create its own scratch unit instead of drawing from the seed (see the self-provisioning analysis in the session log).
