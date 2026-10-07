# 13 — User model tenancy: TENANT_CONTROLLED design analysis

**Date:** 2026-09-14  
**Author:** security audit  
**Status:** decided 2026-10-07 — **Option B**. Part 1 (per-company uniqueness) done; part 2 (`User` → `TENANT_OWNED`) done — see §0.1. The option-(a) helpers stay (§0.1).

---

## 0. Decision and part 1 — 2026-10-07

**Decision:** the same person buying from two developers holds **one account per
developer** — same email and phone, separate passwords, signed into through each
developer's own login, each seeing only that developer's records. Chosen over a
single platform identity with company switching because the product is
white-label (ADR-17): each developer presents as its own app, and a platform-wide
identity would link a customer's developers to each other.

**What was broken before it.** `User.email` / `User.phone` were `@unique`
platform-wide, so:

- the second developer could not register the customer at all
  (`registerCustomerV2` failed on the DB constraint);
- lead paths looked the phone up **platform-wide** (`findUnique({ where: { phone } })`),
  so developer B's lead, reservation and contract were attached to the account
  developer A created. The customer could not see them — `login` under B looks up
  `(email, companyId=B)` and found nothing; under A, the tenant middleware hid B's
  rows. The records existed and nobody could reach them;
- the importer rejected the phone outright ("platform limitation").

**Part 1 — done:**

| Change | Where |
|---|---|
| `@@unique([companyId, email])`, `@@unique([companyId, phone])` replace the global `@unique`s | migration `20261007000002_user_email_phone_unique_per_company` |
| Every lookup by email/phone is company-scoped. Removing the global `@unique` made Prisma reject every `findUnique({ where: { email \| phone } })`, so the compiler listed them; `findFirst` lookups were swept by script | leads, public requests, broker-portal leads/visits/team, broker users, reservations ownership peers, importer |
| Importer: a phone held by another developer is a separate customer, not an error; `crossTenantPhoneConflicts` removed | `data-import` |
| Tenant-less legacy routes: `/auth/forgot-password` (still used by web-admin and the staff app) sends one reset per matching account; `/auth/login` picks the account by password and refuses to guess when two accounts share email **and** password (`TENANT_REQUIRED`) | `auth.service.ts` |
| SUPER_ADMIN (no company): NULLs are distinct in a unique index, so DB-level email uniqueness no longer covers them. No API path creates one; only the seed does | migration note |

**Gate:** `e2e-catalog-auth` **B-OPTB** — Ahmed registers at developer A and at
developer B with the same email and phone; two accounts exist; each developer's
login opens its own account with its own password, and A's password does not open
B; a lead A's sales team adds lands on Ahmed's A account; registering twice at the
same developer is still a 409. With the schema change reverted, the first three
fail. Security **DI-6** rewritten: importing into A a phone B holds creates A's
own customer and leaves B's untouched.

**Part 2 — next:** §7 below. With per-company uniqueness in place, an unscoped
`prisma.user` query by email or phone can now return *another company's* account,
not merely fail to find one — which makes `TENANT_OWNED` enforcement more valuable
than when this document was written.

## 0.1 Part 2 — `User` is `TENANT_OWNED` (2026-10-07)

`MODEL_TENANCY.User` is `TENANT_OWNED`: the middleware scopes every user query
to the request's company, stamps it on create, and refuses a user query with no
context. §7 estimated this at several PRs; once the auth routes ran in the right
context, every e2e and security test passed without touching a single service,
because PR 1's sweep had already put an explicit `companyId` on the lookups.

| Path | Context | Why |
|---|---|---|
| `login-staff`, `tenant/customer/login`, `tenant/customer/register`, `tenant/otp/request`, `tenant/otp/verify`, `tenant/forgot-password` | `runInCompany(slug's company)` | They resolve the company from the slug first; every user lookup inside is that company's |
| `JwtStrategy.validate` | `runAsPlatform` | Runs before `TenantContextInterceptor`; the signed `sub` is what tells us the company |
| `refresh`, `reset-password`, `tenant/reset-password`, `verify-email` | `runAsPlatform` | `@Public` without a slug resolves to `DEFAULT_COMPANY_ID`; the token identifies one account in any company |
| legacy `login`, legacy `forgot-password` | `runAsPlatform` | Tenant-less by design (web-admin and the staff app send no slug); §0 table |
| `login-super-admin` | `runAsPlatform` | SUPER_ADMIN has no company |
| authenticated requests, `@Public` with slug/default, crons | unchanged | Already ran in the caller's company or in bypass |

- **Helpers** (`common/tenant/tenant-context.ts`): `runInCompany` and
  `runAsPlatform` await `fn` inside the context — a `PrismaPromise` is lazy and
  only meets the middleware when awaited, so returning it un-awaited ran it
  outside the context (found on the first run: every JWT check failed).
- **Lint:** importing `runAsPlatform` outside `auth.controller.ts` and
  `jwt.strategy.ts` is an error (`eslint.config.mjs`, Option B allowlist).
- **Seeds** create every user with its `companyId`; `upsertUserByEmail` takes the
  company. The two demo broker seeds attach their users to the admin's company.
- **Gate:** security **MC-5e** — `user.findFirst` with no context throws
  `MissingTenantContextError` (red with `TENANT_CONTROLLED`). e2e **B-OPTB**:
  Ahmed's account at developer B — not the default company — refreshes through the
  tenant-less `/auth/refresh` and `/users/me` returns B's account (red, 401,
  without `runAsPlatform` on refresh); developer A's admin gets 404 on B's
  account by id.
- **Data:** any non-SUPER_ADMIN user with `companyId = NULL` is unreachable from
  now on. FG-24's backfill covered the unambiguous rows; the current data is test
  data and is reset and re-seeded after this merges.

**Not a follow-up after all:** `scopedUserFindMany`, `scopedUserCount`,
`findTenantUser` and `resolveTenantUser` look redundant with the middleware in a
request, but in a bypass context (crons, SUPER_ADMIN) the middleware does not
scope and these helpers — through `getRequiredCompanyId()` — are what fails
closed. Replacing the one in `sendToRoles` with a plain `findMany` would have
sent each maintenance SLA alert to every company's admins. They stay. Checking
this found that the crons did all their per-row work in bypass: see
`08-functional-gaps.md` FG-25 (fixed) and FG-26 (notification templates).

---

## 1. Why User is TENANT_CONTROLLED

The `Model_TENANCY` classification for `User` is:

```
User: 'TENANT_CONTROLLED'
```

The comment in `model-tenancy.ts` explains:

> Has companyId but middleware does NOT inject it. Every query must carry explicit companyId at the service layer.

The `TENANT_OWNED_MODELS` set in `prisma.service.ts` is built from models whose tier is `'TENANT_OWNED'`. `User` is excluded. `POLICY_OPTS = { scopedModels: TENANT_OWNED_MODELS }` therefore never includes `User`, so `applyReadPolicy` returns `args` unchanged for every `prisma.user.*` read operation.

The design comment from `model-tenancy.ts` at line 51 (which covers `User`):

> Globally unique; no per-tenant filter. Accessible in bypass context only

This is partially correct. User IS globally unique (email and phone are `@unique` without a compound key), but it is NOT limited to bypass contexts — it is in active use across all non-bypass authenticated requests. The classification reflects a genuine design constraint, not laziness: several auth paths MUST query across tenants.

There are also two other TENANT_CONTROLLED models for the same reason:
- `OtpCode` (MT-030): `companyId` column added later; service layer supplies it on every read/write  
- `CompanyDomain` (MT-044): queried before tenant context exists (domain resolver runs before any ALS context is set)

---

## 2. Queries that genuinely require cross-tenant access

| File:line | Query | Why it must be cross-tenant |
|---|---|---|
| `auth.service.ts:47` | `findUnique({ where: { email } })` | Email is `@unique` globally; login must find the user regardless of which company they belong to |
| `auth.service.ts:136,140` | parallel `findUnique(email)` + `findUnique(phone)` | Duplicate-detection during `registerOrClaim`; must scan all tenants to prevent email/phone collisions |
| `auth.service.ts:221` | `findUnique({ where: { email } })` | Email-password login — same constraint as above |
| `auth.service.ts:310` | `findUnique({ where: { phone } })` | OTP lookup; phone is `@unique` globally |
| `auth.service.ts:786,812` | `findFirst({ where: { phone } })` | Mobile OTP authenticate — cross-tenant phone lookup for legacy `companyId: null` rows |
| `auth.service.ts:884,888` | `findFirst({ where: { phone } })` + `findFirst({ where: { email } })` | V2 `registerOrClaimV2` duplicate detection |
| `jwt.strategy.ts:22` | `findUnique({ where: { id: payload.sub } })` | JWT `sub` is a UUID issued at login time; the JWT itself carries no tenant claim. This lookup MUST be cross-tenant |
| `broker-portal-team.service.ts:180,192` | `findUnique({ where: { email } })` / `findUnique({ where: { phone } })` | Uniqueness check before creating a broker team member; email/phone collisions must be caught globally |
| `broker-users.service.ts:132,144` | same | Same uniqueness constraint for broker user creation |
| `requests.module.ts:157,161` | `findUnique({ where: { phone } })` / `findUnique({ where: { email } })` | Public "find or create" entry for inbound leads; user may exist under any tenant |

---

## 3. Queries that are wrongly unscoped (the V-20..V-26 vulnerabilities)

These are NOT auth paths. They are authenticated, tenant-context-bearing service calls that forgot to include `companyId`.

| Vulnerability | File:line | Query | Should scope to |
|---|---|---|---|
| V-20 | `notifications.module.ts:774` | `findMany({ where: { active: true } })` | `getRequiredCompanyId()` |
| V-21 | `notifications.module.ts:784` | `findMany({ where: { role: { in: roles }, active: true } })` | `getRequiredCompanyId()` |
| Row 11 | `deposits.service.ts:937` | `findMany({ where: { role: { in: [ADMIN, SM] }, active: true } })` | `getRequiredCompanyId()` |
| V-22 | `bonus.module.ts:737,745` | `findMany({ where: { role: { in: [SALES, SM] } } })` | `getRequiredCompanyId()` |
| V-25 | `reports.service.ts:343` | `count({ where: { role: CUSTOMER } })` | `getRequiredCompanyId()` |
| V-26 | `reports.service.ts:345` | `count({ where: { role: { in: [...staff roles] } } })` | `getRequiredCompanyId()` |

The tenant context IS active for all of these (they run in authenticated handler paths, after `TenantContextInterceptor` has set ALS). `getRequiredCompanyId()` will return the correct company ID. Adding `companyId` to the `where` clause is the complete fix.

---

## 4. Option evaluation

### Option (a) — Keep TENANT_CONTROLLED, fix call sites manually, strengthen lint

Approach: add `companyId: getRequiredCompanyId()` to the 6 vulnerable `prisma.user` queries listed above. Extend the MT-012 ESLint rule to catch `prisma.user.findMany` and `prisma.user.count` calls missing a `companyId` filter outside allowed modules.

**Pros:**
- Zero migration risk; no middleware change
- Auth paths (which are legitimately cross-tenant) continue to work without any modification
- `resolveTenantUser()` already exists as the canonical scoped helper for single-user lookups

**Cons:**
- TENANT_CONTROLLED is opt-in security: every new service that adds a `prisma.user` query must manually remember to include `companyId`
- Lint is a partial deterrent; it can detect patterns but cannot prove the *value* of `companyId` is correct
- This classification has already produced vulnerabilities V-01 through V-26 across two audit cycles

---

### Option (b) — Make User TENANT_OWNED with explicit bypass for auth paths

Approach: add `User` to `TENANT_OWNED_MODELS`. The middleware then auto-injects `companyId` on every read. Add a narrow bypass mechanism for the auth paths.

**This approach is blocked by a structural constraint in the NestJS execution order.**

In NestJS the full execution order is:

```
Middleware → Guards → Interceptors → Pipes → Handler
```

The `JwtAuthGuard` (a Guard) runs **before** `TenantContextInterceptor` (an Interceptor). The JWT strategy `validate()` calls `prisma.user.findUnique({ where: { id: payload.sub } })` — at that point, no ALS context exists.

The current code in `resolveInjectionCompanyId` (`tenant-query-policy.ts:118`):

```typescript
const ctx = getTenantContext();
if (!ctx) {
  throw new MissingTenantContextError(
    `No tenant context active for scoped model '${modelKey}'`,
  );
}
```

If `User` were added to `scopedModels`, **every authenticated request** would throw `MissingTenantContextError` inside the JWT guard's user lookup. All 97 currently-passing security tests would immediately fail with 500.

A workaround (running JwtStrategy inside a bypass context) is possible but introduces its own risk: the bypass context must be narrow enough that it cannot be abused by callers. Every location that calls auth service methods from public routes would also need the bypass, including the `registerOrClaimV2` flow where tenant context IS set (from `X-Tenant-Slug`) but the query still needs to be global (to detect phone collisions across all tenants). This means a `bypass: true` context during auth flows, but the bypass flag today suppresses ALL tenant scoping — it is a blunt instrument, not a per-query mechanism.

**Additional blockers for option (b):**

1. **Legacy `companyId: null` rows**: The mobile OTP flow creates users with `companyId: null`. If middleware injects the V2 company ID, those rows become invisible to OTP claim lookups.
2. **Public auth routes DO have ALS context**: `@Public()` auth routes still run through `TenantContextInterceptor` (it sets the company from `X-Tenant-Slug`). So after fixing the JWT guard ordering, the email/phone lookups inside auth service methods would get tenant-scoped by the middleware — breaking the global collision check and the legacy claim flow.
3. **On-module-init**: `onModuleInit` in services that seed templates or run startup checks has no ALS context. This is already a pre-existing bug (see V-19 analysis). Making User TENANT_OWNED would extend this failure surface to any startup code that touches users.

**Estimated migration scope if option (b) is pursued in a future sprint:**
- ~30 `prisma.user.*` calls in auth.service.ts require individual cross-tenant vs scoped classification
- JwtStrategy refactor to establish a scoped bypass context before the user lookup
- Legacy `companyId: null` cleanup or a parallel lookup path
- Redesign of the OTP claim flow for V2 multi-tenancy
- All public registration/login endpoints reviewed against the new injection behavior

This is a week-plus sprint with meaningful regression risk in the auth flow. It is the right long-term direction but is not safe to execute at the same time as fixing V-20..V-26.

---

## 5. Recommendation

**Implement option (a) now.** Replace direct `prisma.user.*` calls in all non-auth code with the scoped helpers (`scopedUserFindMany`, `scopedUserCount`, `findTenantUser`, `resolveTenantUser`). Restructure the MT-012 lint rule so any new `prisma.user.*` outside the explicit allowlist is a CI error — no per-line suppressions.

**Implement option (b) before first signed contract** — see §7 below.

**Rationale for not picking option (a) because it is smaller:** option (a) is chosen because option (b) is structurally blocked today (guard/interceptor ordering + legacy null-companyId rows), not because it is easier. The recommendation would change immediately if those blockers were resolved. Option (b) is a pre-launch obligation, not a someday item.

---

## 6. Migration risk summary

| | Option (a) | Option (b) today |
|---|---|---|
| Scope | Scoped helpers + lint restructure | ~30 auth paths + JwtStrategy + legacy OTP flow |
| Auth regression risk | None | High (all authenticated requests break on first deploy) |
| New vulnerability surface | None (lint enforces routing through helpers) | Low (auto-scoped by middleware), but auth flow is temporarily broken |
| Test impact | 5 security tests turn green | 97+ tests need JwtStrategy bypass wiring before any pass |
| Recommended timing | Done (this session) | PRE-LAUNCH — see §7 |

---

## 7. PRE-LAUNCH: Concrete option (b) implementation plan

**Status:** Scheduled — must complete before the first production signed contract.

**Goal:** Move `User` to `TENANT_OWNED_MODELS` so the Prisma middleware auto-rejects cross-tenant user reads by default. Auth paths get an explicit `unscopedPrisma` service instead of a context bypass flag.

---

### Why now, not later

There are no customers yet. Every auth-flow test is cheap. After the first signed contract, the legacy `companyId: null` OTP claim flow touches real customer accounts and any migration has live-data risk. The migration is safe to do now and expensive to defer.

---

### Blocker analysis

Three structural blockers must be resolved before `User` can join `TENANT_OWNED_MODELS`:

**B1 — NestJS guard/interceptor ordering**: `JwtStrategy.validate()` runs before `TenantContextInterceptor` sets ALS. If `User` enters `scopedModels`, `resolveInjectionCompanyId` throws `MissingTenantContextError` for every JWT-authenticated request.

**B2 — `resolveInjectionCompanyId` throws on missing context**: Today's code distinguishes only "context present" from "context absent (throw)". There is no "intentionally cross-tenant" state. Auth paths need a first-class bypass that doesn't reuse the coarse `bypass: true` flag (which suppresses ALL tenant scoping).

**B3 — Legacy `companyId: null` OTP claim rows**: `registerOrClaim` and `requestOtp` create users with `companyId: null`. Once the middleware injects the V2 company ID, queries for these rows would return zero results, silently breaking the claim flow.

---

### Implementation sequence

#### Step B-1 — Introduce `unscopedPrisma` service

Create `apps/api/src/common/prisma/unscoped-prisma.service.ts`:

```typescript
@Injectable()
export class UnscopedPrismaService extends PrismaService {
  // A second Prisma client whose $use middleware skips User
  // entirely — no companyId injection, no MissingTenantContextError.
  // Exported only to auth.service.ts, jwt.strategy.ts, and the
  // uniqueness-check files in the MT-012 Tier A allowlist.
}
```

The key design: `UnscopedPrismaService` is a subclass (or a second instance) of `PrismaService` whose `$use` middleware skips the scoped-model check for `User`. It is NOT injectable via the standard `PrismaService` token — it has its own token, and only the Tier A allowlist files can inject it. The lint rule gets a companion selector that flags `this.unscopedPrisma` outside those files.

**Proves:** `JwtStrategy.validate()` uses `UnscopedPrismaService` and passes. All other authenticated requests continue to use `PrismaService` with no change.

**Estimate:** 1 day. Zero test impact on existing suite.

#### Step B-2 — Migrate Tier A files to `unscopedPrisma`

Swap `this.prisma` → `this.unscopedPrisma` in auth.service.ts, jwt.strategy.ts, broker-portal-team.service.ts, broker-users.service.ts, requests.module.ts, identity-claim.ts.

Run the security suite (currently 97 passing). All auth flows must still pass. No behaviour change — these paths were already unscoped.

**Estimate:** 1 day. Security suite must still be 97+.

#### Step B-3 — Resolve legacy `companyId: null` rows

Audit and migrate `companyId: null` users:
- Run: `SELECT COUNT(*) FROM "User" WHERE "companyId" IS NULL`
- If count > 0: determine which default company they belong to (from phone prefix, OTP source, or admin assignment). Run a one-off migration assigning `companyId`.
- Update `registerOrClaim` and `requestOtp` to always write a companyId (sourced from the active tenant context, which is set from `X-Tenant-Slug` on every request).
- Add a NOT NULL constraint migration once the backfill is complete.

**Estimate:** 0.5–2 days depending on null-row volume. Requires a migration against production data.

#### Step B-4 — Add User to `TENANT_OWNED_MODELS`

In `prisma.service.ts`, add `'user'` to `TENANT_OWNED_MODELS`. Update `model-tenancy.ts`:

```typescript
User: 'TENANT_OWNED',  // was 'TENANT_CONTROLLED'
```

Update `MT-016` tests to expect `TENANT_OWNED`. Remove the `TENANT_CONTROLLED` test for `User`.

Run: typecheck + unit + security. Expect all 102+ security tests to pass. Any failure indicates a path that still uses `PrismaService` for a cross-tenant user query.

**Estimate:** half a day + debug time for any failures.

#### Step B-5 — Remove option (a) helpers from hot paths

The `scopedUserFindMany`, `scopedUserCount` helpers (added in the option (a) fixes) inject `companyId` explicitly. Once `User` is `TENANT_OWNED`, the middleware also injects `companyId`. This creates double-injection: `{ ...where, companyId }` merged with the middleware's `companyId` injection — effectively no-op if both are the same value. To keep the code clean:

- Replace `scopedUserFindMany(this.prisma, ...)` with direct `this.prisma.user.findMany(...)` calls (now safe because the middleware enforces the scope).
- Remove `scopedUserFindMany`, `scopedUserCount`, `findTenantUser` from `resolve-tenant-entity.ts` (keep `resolveTenantUser` — it adds role validation).
- Remove the non-auth files from the MT-012 allowlist (they no longer need direct `prisma.user` access).
- The MT-012 allowlist shrinks to `UnscopedPrismaService` + its Tier A consumers only.

**Estimate:** 1 day (mostly mechanical removal + lint passes).

#### Step B-6 — Gate

Update `docs/audit/13-user-tenancy.md` status to "COMPLETE". Close the pre-launch tracking issue.

---

### Total effort estimate

| Step | Work | Est. |
|---|---|---|
| B-1 | `UnscopedPrismaService` + lint companion selector | 1 day |
| B-2 | Migrate Tier A files to unscopedPrisma | 1 day |
| B-3 | Null-companyId backfill + migration | 0.5–2 days |
| B-4 | Add User to TENANT_OWNED_MODELS | 0.5 days |
| B-5 | Remove option (a) scaffolding | 1 day |
| B-6 | Gate + docs | 0.5 days |
| **Total** | | **4–6 days** |

Four to six days of engineering, zero customer risk if done before first signed contract. After first signed contract, step B-3 requires live-data migration — add 1–2 days of caution and a maintenance window.
