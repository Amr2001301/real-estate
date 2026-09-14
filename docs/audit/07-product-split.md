# Product Split Audit — Developer System vs Brokerage System
**Audit date:** 2026-09-13  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Repo root:** `/Users/amr/Real Estate`  
**Prior reading:** `docs/audit/01-system-map.md` (sections 1, 2, 7), `docs/audit/02-rbac-tenancy.md` (sections 2, 5), `docs/audit/04-fix-log.md`

> **Read-only audit.** No source files were modified. All counts were measured by running the commands shown.

---

## Question 1 — What Exists for Product B Today

### Inventory

#### API modules

| Module | Classification | Evidence |
|---|---|---|
| `brokers` | PRODUCT A ONLY | Admin CRUD for partner broker firms owned by a developer company. `Broker.companyId` → developer's Company. |
| `broker-users` | PRODUCT A ONLY | Admin invites/manages employees of a partner broker firm inside the developer's tenant. |
| `broker-access` | PRODUCT A ONLY | Developer admin grants a partner broker access to the developer's projects and units. |
| `broker-leads` | PRODUCT A ONLY | Partner broker submits leads into the developer's CRM for approval. |
| `broker-reservations` | PRODUCT A ONLY | Reservations created by a partner broker, attributed inside the developer's pipeline. |
| `broker-commissions` | PRODUCT A ONLY | Developer pays commissions to partner broker firms. |
| `broker-payouts` | PRODUCT A ONLY | Payout lifecycle DRAFT→PAID for partner broker firms inside the developer's tenant. |
| `broker-contracts` | PRODUCT A ONLY | Developer-facing view of contracts attributed to partner brokers. |
| `broker-reports` | PRODUCT A ONLY | Aggregated analytics on broker performance for the developer admin. |
| `broker-portal` | PRODUCT A ONLY | Self-service portal for users with `role=BROKER` — scoped entirely to one developer's tenant via `BrokerScopeGuard` (`broker-scope.guard.ts:52`). |

#### Prisma models

| Model | Classification | Evidence |
|---|---|---|
| `Broker` | PRODUCT A ONLY | `companyId` FK → single developer Company (`schema.prisma:1934`). |
| `BrokerUser` | PRODUCT A ONLY | `companyId` FK → same developer Company (`schema.prisma:1958`). The user also has `User.companyId` pointing to the same developer tenant. |
| `BrokerProjectAccess` | PRODUCT A ONLY | `brokerId` + `projectId` with `companyId` = developer's company. A grant from a developer to a partner broker. |
| `BrokerUnitAccess` | PRODUCT A ONLY | Same structure as BrokerProjectAccess. |
| `BrokerCommission` | PRODUCT A ONLY | `companyId` = developer's company. Commission is paid by the developer. |
| `BrokerPayout` | PRODUCT A ONLY | Same; payout is from the developer to the partner broker firm. |
| `BrokerActivityLog` | PRODUCT A ONLY | Scoped to developer tenant by `companyId`. |

#### `BROKER` role in `UserRole` enum

**PRODUCT A ONLY.** A `BROKER` user has `User.companyId` pointing to a developer company. `BrokerScopeGuard` asserts `user.companyId != null` and uses it to enter the developer's tenant ALS context (`broker-scope.guard.ts:52–57`). The role is "partner agent inside a developer tenant", not "employee of an independent brokerage firm."

Evidence from `auth.service.ts:59`: `user.role !== 'BROKER'` is used to gate staff login — brokers log into the developer's tenant staff login.

#### Mobile staff `/broker/*` routes

**PRODUCT A ONLY.** All 9 broker screens in `mobile_staff` (home, project/unit detail, create lead, lead detail, create/detail reservation, commissions, profile) call `/portal/*` API endpoints. Those endpoints use `BrokerScopeGuard` which derives the developer company from `user.companyId`. These screens are for a partner broker agent operating within a specific developer's tenant.

#### Web admin `/dashboard/broker-*` pages

**PRODUCT A ONLY.** All 12 broker-related admin pages (brokers list, create, detail, edit, users, access, performance, broker-leads, broker-reservations, broker-commissions, broker-payouts, broker-contracts, broker-reports) are ADMIN-gated screens for the developer to manage their partner broker relationships.

### Plain answer

**Nothing resembling an independent brokerage system is implemented.** Every broker-related module, model, route, screen, and role describes "a partner broker firm that a developer company controls" — not "an independent brokerage company that works with multiple developers."

The `Company.type = BROKERAGE` enum value and the schema comment at `schema.prisma:42` ("BROKERAGE: independent broker company") acknowledge the concept exists on paper. **Zero runtime code branches on this value.** It is stored and returned in the super-admin company serializer (`super-admin.service.ts:93`) and written at company creation (`super-admin.service.ts:143`). That is the full extent of its use.

---

## Question 2 — The Structural Blocker

### Can one Broker row belong to more than one Company?

**No.** `Broker.companyId` is a single nullable FK:

```prisma
# schema.prisma:1934
companyId String?  @db.Uuid
company   Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)
```

One Broker row → at most one Company. There is no join table, no array, no alternative relation.

### What the schema forces brokerage firm X to do

If brokerage firm X works with developer companies P, Q, and R under the current schema:

| Problem | Current forced solution | Cost |
|---|---|---|
| X needs to be visible to P's admin | Create a separate `Broker` row with `companyId = P.id` | 3 Broker rows for the same real firm |
| X's employee Alice needs to log into P's portal | Invite Alice as a `BrokerUser` scoped to P; `User.companyId = P.id` | Separate user account per company |
| Alice needs access to Q's portal | Create a second `User` row with `User.companyId = Q.id`; second `BrokerUser` row | Duplicate accounts, duplicate passwords, separate JWTs |
| X's commission from P vs Q | Two separate `BrokerCommission` rows, each in a different tenant | No consolidated view across developers |
| X's payout from P vs Q | Two separate `BrokerPayout` workflows | No single P&L for brokerage firm X |

The schema fundamentally cannot represent "one brokerage firm, multiple developer clients" without data duplication and multiple user accounts per real person.

### Does a many-to-many link between a brokerage firm and developer companies exist?

**No.** Searched the full schema for any join table or cross-company relation:

```
grep -rn "BrokerFirm\|firm\|many.*developer\|cross.*company\|BrokerageDeveloperAccess" \
  apps/api/prisma/schema.prisma
```

Zero results. There is no `BrokerageFirmDeveloperAccess`, no `Company → [Company]` array, no cross-Company relation of any kind.

**The missing relation:** a first-class join table — `BrokerageDeveloperAccess { brokerageCompanyId → Company(type=BROKERAGE), developerCompanyId → Company(type=DEVELOPER), status, commissionTerms, ... }` — where the brokerage firm is its own `Company` row rather than a sub-entity within a developer's tenant.

---

## Question 3 — Where the Two Products Already Collide

### Company.type branches in `apps/api/src/`

**Command run:**
```
grep -rn "company\.type\|Company\.type\|type.*===.*DEVELOPER\|type.*===.*BROKERAGE\|BROKERAGE.*===\|DEVELOPER.*===" \
  apps/api/src --include="*.ts" | grep -v "spec|test|import|enum|dto|schema"
```

**Result: zero runtime branches.**

| File:line | What it does | Location |
|---|---|---|
| `super-admin.service.ts:93` | Serializes `company.type` into a DTO for the super-admin company detail view. Read-only, no branch. | Super-admin controller boundary — display only |
| `super-admin.service.ts:143` | Writes `type: dto.type ?? 'DEVELOPER'` when creating a company. Defaults to DEVELOPER if omitted. | Super-admin write path — no business-logic branch |

`Company.type` is stored and returned. It is **never used to gate a route, change service behavior, or alter a Prisma query** anywhere in the codebase.

### Routes reachable by a Company.type = BROKERAGE tenant

Because there are no CompanyType-aware guards, a BROKERAGE company admin has the same access as any DEVELOPER admin — controlled only by `UserRole.ADMIN` + `@Permissions`. The following developer-only routes are unblocked for a BROKERAGE tenant:

| Route | Guard present | CompanyType guard | Verdict |
|---|---|---|---|
| `POST /projects` | `@Roles(ADMIN)` + `@Permissions(projects:create)` | none | **REACHABLE — nothing blocks it** |
| `POST /units` | `@Roles(ADMIN)` | none | **REACHABLE — nothing blocks it** |
| `POST /phases` | `@Roles(ADMIN)` + `@Permissions(phases:manage)` | none | **REACHABLE — nothing blocks it** |
| `POST /buildings` | `@Roles(ADMIN)` + `@Permissions(buildings:manage)` | none | **REACHABLE — nothing blocks it** |
| `POST /cms/pages`, `/cms/banners`, `/cms/articles` | `@Roles(ADMIN)` | none | **REACHABLE — nothing blocks it** |
| `POST /installment-plan-templates` | `@Roles(ADMIN)` | none | **REACHABLE — nothing blocks it** |
| `GET /reports/financial`, `/reports/kpis` | `@Roles(ADMIN)` | none | **REACHABLE — nothing blocks it** |

These routes are gated by role, not by company type. An ADMIN in a `Company.type = BROKERAGE` tenant reaches all of them.

---

## Question 4 — Capability Enforcement: Does It Exist at All

### Company.capabilities

**Infrastructure: exists and is correctly implemented.**

| File | What it does |
|---|---|
| `common/capabilities/capability.service.ts` | `CapabilityService` — reads `Company.capabilities` from DB with Redis cache (TTL 300s), exposes `hasCapability()`, `requireCapability()`, `getCapabilities()`, `setCapabilities()`, `invalidateCache()`. |
| `common/guards/capability.guard.ts` | `CapabilityGuard` — reads `@RequireCapability('key')` metadata from route/class reflector, calls `capabilityService.requireCapability()`, passes SUPER_ADMIN. |
| `common/decorators/require-capability.decorator.ts` | `@RequireCapability(key)` — sets `SetMetadata(REQUIRE_CAPABILITY_KEY, key)` on the handler. |
| `common/capabilities/capability.module.ts` | `@Global` module, exports `CapabilityService`. |
| `app.module.ts:76` | `CapabilityModule` is imported. |

**Enforcement: absent.**

```
grep -rn "@RequireCapability\|RequireCapability(" apps/api/src/modules --include="*.ts" | grep -v spec | wc -l
# Result: 0
```

`@RequireCapability` is used on **zero routes**. `CapabilityGuard` is **not in the global app guards** (confirmed: `app.module.ts` lists `ThrottlerGuard`, `JwtAuthGuard`, `CompanyLifecycleGuard`, `RolesGuard`, `PermissionsGuard` — no `CapabilityGuard`). The decorator comment says "Must be paired with CapabilityGuard (registered globally or on the controller)" — neither condition is met anywhere.

**Conclusion for capabilities:** CapabilityService reads `Company.capabilities` only when called by super-admin (`super-admin.service.ts:44,95,242`) to display and update the blob. No route checks capabilities before granting access. A BROKER-type tenant can use every developer-only feature regardless of what is stored in `capabilities`.

### Company.modules

```
grep -rn "company\.modules\|\.modules\b" apps/api/src --include="*.ts" | grep -v "spec|test|import"
```

Two hits, both in `super-admin.service.ts`:
- Line 106: `modules: company.modules` — serialized in company detail view  
- Line 430: `{ ...defaults, ...(company.modules as object ?? {}) }` — read to return defaults + stored modules  
- Line 437: `data: { modules: dto.modules }` — written by super-admin update endpoint

**Zero reads that enforce feature access.** `modules` is display-only.

### websiteEnabled

**Server-side enforced.** `domain-resolver.service.ts:77,95` includes `websiteEnabled` in the domain resolution response. `web-public/middleware.ts:60–62` reads the resolved value and propagates it as header `x-resolved-tenant-website-enabled`. Page routing gates on this (`web-public/lib/tenant.ts:26`). If `websiteEnabled=false`, the public site returns 503.

### customerAppEnabled

**Partially server-side enforced.** `public-companies.service.ts:25` includes `customerAppEnabled: true` in the WHERE clause for company discovery. The mobile customer app can only discover companies with this flag set. However, existing authenticated users who already know their company slug bypass discovery — `customerAppEnabled` is not rechecked on login or token refresh.

### staffAppEnabled

**Not server-side enforced.** Search:

```
grep -rn "staffAppEnabled" apps/api/src --include="*.ts" | grep -v "test|spec|import|dto|super-admin|domain-resolver"
# Result: 0 hits
```

`staffAppEnabled` is stored, returned in super-admin company detail, and written by the update endpoint. It is never checked in any API guard, service, or middleware. Mobile staff app startup code also does not check it (no startup service file found in `mobile_staff/lib/startup/`). Enforcement is absent.

### Summary

| Field | Reads in API (enforcement) | Verdict |
|---|---|---|
| `Company.capabilities` | 0 route checks | **Not enforced — infrastructure only** |
| `Company.modules` | 0 route checks | **Not enforced — display only** |
| `websiteEnabled` | domain-resolver → web-public middleware | **Enforced server-side** |
| `customerAppEnabled` | public-companies discovery query filter | **Partially enforced (discovery only)** |
| `staffAppEnabled` | 0 route checks | **Not enforced anywhere** |

Today, nothing prevents a `Company.type = BROKERAGE` tenant from using developer-only features. The capability infrastructure (service + guard + decorator) is correct and would work if applied — it is simply not applied to any route.

---

## Question 5 — Doors That Would Close

Assumptions in the current code that would make Product B expensive to add later.

| Assumption | Where (file:line) | Cost to reverse later | Cheap to make future-proof NOW without building Product B? |
|---|---|---|---|
| `Broker.companyId` — single FK; a partner broker belongs to exactly one developer company | `schema.prisma:1934` | M — requires new `BrokerageDeveloperAccess` join table + migration + new query patterns in all broker services | YES — add one schema comment naming the constraint and the expected future shape. No code change needed. |
| `User.companyId` — single company per user; a broker agent cannot be in multiple developer tenants simultaneously | `schema.prisma`, User model | L — needs a user-company membership table or per-company user records; touches every auth path, every guard, and ALS setup | NO — too fundamental; change only when building Product B |
| `BrokerScopeGuard` derives `companyId` from `user.companyId` (the developer's company) | `broker-scope.guard.ts:52` | M — for Product B, the brokerage firm is its own Company; the guard would need to look up the brokerage firm's developer clients separately | YES — add a comment naming the Product B path. No code change. |
| `BrokerProjectAccess.companyId` scoped by Prisma middleware to the developer's tenant | `schema.prisma:1978`, Prisma middleware | L — a BROKERAGE company cannot read DEVELOPER company projects through normal Prisma queries; the entire cross-company access model requires a bypass or a new query pattern | NO — structural; requires a deliberate design decision when building Product B |
| No `Company → Company` relation (BROKERAGE firm ↔ DEVELOPER clients) | `schema.prisma` — absent | M — one new join table needed | YES — add one `// TODO(Product-B): add BrokerageDeveloperAccess join table here` comment in schema. Cost: one line. |
| `BROKER` UserRole means "partner agent inside a developer tenant" | `schema.prisma:170`, `broker-scope.guard.ts:42` | M — for Product B, BROKER means "employee of an independent brokerage firm"; the role's semantic needs to shift and `BrokerScopeGuard` must enter the brokerage firm's own tenant | YES — document the semantic shift in a comment on the enum. No code change. |
| JWT `user.companyId` is a single value (developer's company for broker users) | `jwt.strategy.ts:24–32` | Already mitigated — `JwtStrategy.validate()` does a DB reload on every request; the JWT payload carries only `sub`. Changing `User.companyId` to a membership table is the only breaking change, not the JWT itself. | N/A — already future-safe |
| Developer-only routes (`/projects`, `/units`, `/phases`, etc.) have no `CompanyType` guard | All admin controllers | L — many files; every write route would need a type check | NO — not cheap now; the right time is when BROKERAGE tenants are onboarded and specific routes need restricting |

**The single cheapest action that does real work:** add a `@@index` comment and schema note in `schema.prisma` at the `Broker` model and `CompanyType` enum naming the Product B `BrokerageDeveloperAccess` table that will be needed. That prevents the next developer from implementing Product B by shoehorning it into the existing `Broker.companyId` pattern.

---

## Question 6 — Product A Readiness: Honest Gap List

**Evidence base:** `01-system-map.md` sections 5 and 6, `02-rbac-tenancy.md`, and direct code search.

### Would block a first paying customer

| Gap | Evidence | Severity |
|---|---|---|
| **No payment gateway** — installment and deposit collection is offline-only (manual proof upload, staff reviews) | `01-system-map.md:651` — "No Stripe, Paymob, Moyasar, PayPal, or any payment provider SDK is referenced anywhere" | **Blocker** — a customer cannot pay an installment online |
| **Notification email delivery absent** — `NotificationTemplate.channel=EMAIL` persists a DB row but no SMTP send occurs; only password-reset and email-verify emails are sent | `01-system-map.md:613`, `notifications.module.ts:231–340` | **Blocker** — operational notifications (installment due, contract ready, maintenance update) are silently dropped |
| **FCM push credentials may be absent** — `FirebaseService` silently no-ops without `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | `firebase.service.ts:25`, `01-system-map.md:626` — "NEEDS HUMAN INPUT" | **Blocker if unprovisioned** — all push notifications silently fail |
| **Twilio credentials may be absent** — phone OTP login falls back to console logging in production without Twilio creds; users cannot log in via phone | `sms.service.ts:23`, `01-system-map.md:619` — production env rejects `OTP_PROVIDER=console` | **Blocker if unprovisioned** — phone-OTP-only users cannot authenticate |

### Can ship without (MVP acceptable)

| Gap | Evidence | Note |
|---|---|---|
| **InfoRequest RESPONDED/CLOSED write path missing** — status is set to OPEN on create and never updated; `RESPONDED`/`CLOSED` transitions are dead code | `requests.module.ts:200`, `01-system-map.md:707` | Staff calls the customer manually; system just collects the inquiry |
| **Online contract signing absent** — `Contract.pdfUrl` is an admin-supplied URL; `signedAt` is set manually | `01-system-map.md:99` | Workable at small volume; DocuSign integration is a scale concern |
| **`Company.isActive` ↔ `lifecycleStatus` dual state** — split-brain risk on out-of-sync updates | `01-system-map.md:736–742` | Risk is low until multi-admin direct-DB access occurs; `CompanyLifecycleGuard` uses `lifecycleStatus` correctly |
| **`SALES GET /leads/:id` row-level bypass** — fixed in Phase 7A (`04-fix-log.md:STEP 2`) | `04-fix-log.md:94–97` | Fixed; noting for completeness |
| **Chat session PII unencrypted, anonymousId client-generated** | `02-rbac-tenancy.md:387` | Not customer-facing blocker for MVP; marketing chat has low PII risk in practice |
| **`NotificationTemplate.code` unique constraint is global across all tenants** | `02-rbac-tenancy.md:489` | Blocker only when a second company is onboarded with a conflicting template code; service-layer guard added in `04-fix-log.md:STEP 4` |

---

## Verdict

**Product B — independent brokerage system: ABSENT.** Every broker-related module, model, role, route, and screen is a "broker-as-role-inside-a-developer" feature (Product A). The `Company.type = BROKERAGE` enum value and the `Company.capabilities` / `Company.modules` enforcement infrastructure exist on paper but are schema-only; zero runtime code branches on them.

**The single most important thing to do now to keep Product B possible later without building it:** add schema comments on the `Broker` model and `CompanyType` enum that name the `BrokerageDeveloperAccess` join table that Product B will require, and add a comment on `BrokerScopeGuard` noting that `user.companyId` currently points to the developer tenant — not the brokerage firm's own company. This costs three comment lines, prevents future developers from deepening the structural assumption, and leaves the schema clean enough that Product B can be added as an additive change rather than a rewrite.
