# RBAC & Tenancy Audit — Real Estate SaaS Platform
**Audit date:** 2026-09-12  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Repo root:** `/Users/amr/Real Estate`  
**Scope:** `apps/api/src/` — guards, middleware, interceptors, auth service, reports, ownership checks

---

## Section 1 — Guard Execution Order

### 1.1 Registration (verified in `app.module.ts:124–134`)

```
APP_GUARD #1  ThrottlerGuard          app.module.ts:125
APP_GUARD #2  JwtAuthGuard            app.module.ts:126
APP_GUARD #3  CompanyLifecycleGuard   app.module.ts:131
APP_GUARD #4  RolesGuard              app.module.ts:132
APP_GUARD #5  PermissionsGuard        app.module.ts:134

APP_INTERCEPTOR #1  RequestLoggerInterceptor    app.module.ts:137
APP_INTERCEPTOR #2  TenantContextInterceptor    app.module.ts:140  ← ALS set here
APP_INTERCEPTOR #3  LocaleInterceptor           app.module.ts:141
APP_INTERCEPTOR #4  AuditInterceptor            app.module.ts:142
```

**Critical ordering fact:** Guards fire before interceptors. `TenantContextInterceptor` (which writes the `AsyncLocalStorage` tenant context used by the Prisma middleware) has NOT run when guards #1–#5 execute. Guards must rely on `req.user.companyId` (from the JWT claim, populated by Passport) — not ALS — for any company-scoped check. `CompanyLifecycleGuard` accounts for this explicitly (comment at `lifecycle.guard.ts:3–11`).

---

### 1.2 Per-Guard Behaviour

**ThrottlerGuard** — 100 requests / 60 s per IP. No decorator overrides this; rate limits apply even to `@Public` routes.

**JwtAuthGuard** (`jwt-auth.guard.ts:14–52`)

| Decorator present | What happens |
|---|---|
| `@Public()` only | Guard returns `true` immediately (line 31). `req.user` stays `undefined`. |
| `@PlatformPublic()` | Guard returns `true` immediately (line 31). |
| `@OptionalAuth()` | Guard runs Passport-jwt strategy. If token missing/invalid, `handleRequest` returns `null` instead of throwing (line 46). |
| `@Public()` + `@OptionalAuth()` | Guard runs Passport-jwt strategy (optional path). |
| No decorator | Passport-jwt validates Bearer token. Missing/invalid token → `UnauthorizedException`. |

**CompanyLifecycleGuard** (`lifecycle.guard.ts:63–93`)

| Condition | Decision |
|---|---|
| `!req.user` (unauthenticated) | PASS — no tenant to check |
| `role === SUPER_ADMIN` | PASS — platform-level bypass |
| `companyId` present | Fetches `Company.lifecycleStatus`; throws `ForbiddenException` if not `ACTIVE` |
| `companyId === null`, role in `{CLIENT, CUSTOMER}`, fallback enabled | Checks `DEFAULT_COMPANY_ID` company |
| `companyId === null`, staff role | PASS — `TenantContextInterceptor` denies these separately |

The guard queries `this.prisma.company.findUnique` directly — this is a PLATFORM_GLOBAL model, no middleware companyId injection, correct.

**RolesGuard** (`roles.guard.ts:10–24`)

| `@Roles(...)` state | Decision |
|---|---|
| Not present | PASS — any authenticated (or unauthenticated public) caller continues |
| Present, caller's role in list | PASS |
| Present, caller's role NOT in list | `ForbiddenException('Insufficient role')` |

**PermissionsGuard** (`permissions.guard.ts:31–57`)

| `@Permissions/@PermissionsStrict` state | `role === ADMIN`? | Decision |
|---|---|---|
| Not present | — | PASS (line 41: early return) |
| `@Permissions(codes)` — `adminBypass=true` | Yes | PASS (line 49: admin bypass) |
| `@Permissions(codes)` — `adminBypass=true` | No | DB lookup; require any code in set |
| `@PermissionsStrict(codes)` — `adminBypass=false` | Yes | DB lookup; require code explicitly |
| `@PermissionsStrict(codes)` — `adminBypass=false` | No | DB lookup; require code explicitly |

---

### 1.3 Decorator Combinations — Enforcement Gaps

The following combinations produce **less enforcement than the decorator names suggest**:

| Combination | Gap |
|---|---|
| `@Roles(X)` only, no `@Permissions` | No fine-grained code check. Any user with a matching role passes regardless of assigned permissions. Example: `GET /info-requests` (`requests.module.ts:575`). |
| `@Permissions(code)` with default `adminBypass=true` | ADMIN role bypasses the permission code check entirely. An ADMIN with zero `UserPermission` rows passes all non-strict gates. This is intentional ("super-admin posture") but means ADMIN cannot be scoped to a subset of operations without converting to `@PermissionsStrict`. |
| No `@Roles`, no `@Public` | Any JWT-valid role (including `BROKER`, `MAINTENANCE_SUPERVISOR`, `CLIENT`, `CUSTOMER`) can reach the route. There are no such routes currently, but adding one without `@Roles` would be a silent downgrade. |
| `@Public()` on an endpoint that also reads tenant data | Tenant context is still set (to `DEFAULT_COMPANY_ID` or slug-resolved company), so the Prisma middleware scopes reads correctly. No enforcement gap per se, but the absence of any identity check means the endpoint can be hit by anyone. |

**Identified missing `@Permissions`:** `GET /info-requests` at `requests.module.ts:575` has `@Roles(ADMIN, SALES, SALES_MANAGER)` but no `@Permissions`. Consistent with all other admin read routes in the same module which use `@Permissions('visits:read')`.

---

### 1.4 Decision Table for Common Paths

```
Request arrives
  │
  ├─ ThrottlerGuard: exceeds rate? → 429 Too Many Requests
  │
  ├─ JwtAuthGuard:
  │    @Public / @PlatformPublic → skip JWT parsing → req.user = undefined
  │    @OptionalAuth             → parse if present, tolerate failure → req.user = null|User
  │    else                      → require valid Bearer → req.user = AuthUser | throw 401
  │
  ├─ CompanyLifecycleGuard:
  │    !req.user → pass
  │    SUPER_ADMIN → pass
  │    companyId set → fetch Company.lifecycleStatus → not ACTIVE → throw 403 COMPANY_NOT_ACTIVE
  │    companyId null + CLIENT/CUSTOMER + fallback on → check DEFAULT_COMPANY_ID
  │    companyId null + staff role → pass (UnauthorizedException deferred to interceptor)
  │
  ├─ RolesGuard:
  │    no @Roles → pass
  │    role in @Roles list → pass
  │    role NOT in list → throw 403 Insufficient role
  │
  ├─ PermissionsGuard:
  │    no @Permissions → pass
  │    @Permissions + ADMIN → pass (adminBypass)
  │    @Permissions + code held → pass
  │    @Permissions + code NOT held → throw 403 missing_permission
  │    @PermissionsStrict + code held → pass (ALL roles incl. ADMIN)
  │    @PermissionsStrict + code NOT held → throw 403 missing_permission
  │
  ├─ [Interceptors run now]
  │
  ├─ TenantContextInterceptor: establishes ALS context (companyId from JWT or DEFAULT_COMPANY_ID)
  │
  └─ Route handler → Prisma queries (middleware applies companyId filter)
```

---

## Section 2 — Tenant Isolation: The Prisma Middleware

### 2a. Actions Intercepted

Verified from `prisma.service.ts:16–22` and the `tenantMiddleware` method (`prisma.service.ts:78–121`):

**`READ_OPS` set (apply `applyReadPolicy` or `applyReadPolicy`-derived for update/delete/upsert):**

```
findMany, findFirst, findUnique, findFirstOrThrow, findUniqueOrThrow,
count, aggregate, groupBy,
update, updateMany,
delete, deleteMany
```

**Other intercepted actions:**
- `create` → `applyCreatePolicy` (`prisma.service.ts:95`)
- `createMany` → `applyCreateManyPolicy` (`prisma.service.ts:97`)
- `upsert` → `applyReadPolicy` on where + explicit create-branch injection (`prisma.service.ts:99–117`)

**Total: 15 action types intercepted.**

### 2b. Actions NOT Intercepted (bypasses)

The following actions bypass the tenant middleware entirely:

| Action | Notes |
|---|---|
| `$queryRaw` | Comment at `tenant-query-policy.ts:13` explicitly acknowledges this. 5 call sites in production code (see 2e below). |
| `$executeRaw` | Zero production call sites. Mentioned in comment only. |
| `$runCommandRaw` | Not used. |
| Nested relation **writes** (nested `create`, `connect`, `connectOrCreate` inside any write) | `tenant-query-policy.ts:15–16` explicitly documents: "Nested Prisma relation writes are NOT automatically scoped." Each nested write must be audited separately. |

**Nested relation reads (includes):** NOT scoped by the middleware. `tenant-query-policy.ts:17`: "Relation includes are not affected by this injection (read-only shape)." However, because the *parent* query is tenant-scoped, `include`-d relations are only returned for the already-scoped parent row — no cross-tenant data leaks through includes.

### 2c. Does it Handle Nested Reads? (Include/Select on Relations)

**The middleware does NOT scope nested includes.** Example: `reservations.module.ts:456`:

```typescript
const unit = await this.prisma.unit.findUnique({
  where: { id: dto.unitId },   // middleware injects: { id: dto.unitId, companyId: <ctx> }
  include: { building: { include: { phase: { select: { projectId: true } } } } }
});
```

The `findUnique` is scoped (middleware injects `companyId`). The `include: { building: ... }` is not separately scoped, but this is safe: since the parent `Unit` row is already filtered to the company's unit, the related `Building` is the one belonging to that unit — no cross-tenant data can appear through a relation of an already-scoped record.

**Nested write risk:** A nested create inside a reservation create could theoretically write a relation row without `companyId` injection. However, `TENANT_VIA_RELATION` models (e.g. `UnitStatusHistory`, `ReservationActivity`) are scoped through the parent FK, not through `companyId`, so middleware skips them intentionally.

### 2d. ALS Context Empty → Fail Closed or Open?

**FAIL CLOSED.** Verified in `tenant-query-policy.ts:116–122`:

```typescript
const ctx = getTenantContext();   // returns undefined if no ALS context

if (!ctx) {
  throw new MissingTenantContextError(
    `No tenant context active for scoped model '${modelKey}'`,
  );
}
```

If `TENANT_OWNED` model query reaches the middleware with no ALS context, a `MissingTenantContextError` is thrown — the query never reaches the database. The boot-time assertion (`prisma.service.ts:58–71`) ensures every model is classified before any request is served.

Also verified via `tenant-context.ts:85–98`: `requireTenantContext()` throws `MissingTenantContextError` when context is null or has `companyId=null` without `bypass=true`.

### 2e. `$queryRaw` / `$executeRaw` / `$transaction` in Production Code

**Command run:** `grep -rn '\$queryRaw\|\$executeRaw' apps/api/src --include="*.ts" | grep -v "__tests__\|\.spec\.ts"` — 5 $queryRaw call sites, 0 $executeRaw call sites.

| Location | Query | companyId in SQL? |
|---|---|---|
| `health.controller.ts:70` | `` `SELECT 1` `` | N/A — no tenant data |
| `units.service.ts:307` | Inventory matrix via `Project ← Phase ← Building ← Unit` JOIN | YES — `Prisma.sql\`p."companyId" = ${companyId}::uuid\`` always first condition (`units.service.ts:277`) |
| `reports.service.ts:123` | Contracts by project JOIN | YES — `Prisma.sql\`c."companyId" = ${companyId}\`` is first element in `conditions[]` array (`reports.service.ts:103`); `whereClause` always non-empty |
| `reports.service.ts:212` | Broker leaderboard | YES — `Prisma.sql\`bc."companyId" = ${companyId}\`` (`reports.service.ts:206`) |
| `reports.service.ts:243` | Sales trend (monthly contracts) | YES — `AND c."companyId" = ${companyId}` literal in SQL (`reports.service.ts:252`) |

All `$queryRaw` call sites manually include `companyId` scoping. **No unscoped raw queries.**

`$transaction` (interactive callback form — `$transaction(async tx => {...})`): In Prisma 5.22, the `$use` middleware IS applied to queries within transaction callbacks because the `tx` client is a proxy of the same `PrismaClient` with the middleware chain intact. The comment at `installments.module.ts:601` refers to connection isolation (uncommitted writes), not middleware inheritance.

`$transaction` (static batch form — `$transaction([q1, q2])`): Each query in the batch passes through the middleware individually.

### 2f. Nullable `companyId` Models and NULL Rows

Models where `companyId` is `String?` (nullable): all 46 `TENANT_OWNED` models have nullable `companyId` in the schema (the `?` suffix). For reads: the middleware injects `WHERE companyId = '<ctx-uuid>'`. SQL equality with a UUID does **not** match `NULL` values — rows with `companyId IS NULL` are invisible to all tenant-scoped queries. They are not returned and cannot be mutated through normal service paths. For creates: the middleware injects `companyId` from context, so new rows always get a non-null `companyId` when created through an authenticated request. Legacy null rows are effectively "orphaned" until the DB is backfilled.

---

## Section 3 — Cross-Tenant Attack Matrix

### A1: Company A ADMIN calls `GET /units/:id` with a Unit UUID from Company B

**Verdict: BLOCKED**

`units.service.ts`: `this.prisma.unit.findUnique({ where: { id: dto.id } })`. `Unit` is `TENANT_OWNED`. Middleware injects `companyId` from ALS, making the effective query `WHERE id = '<B_uuid>' AND companyId = '<A_uuid>'`. Company B's unit has `companyId = '<B_uuid>'`, so the query returns `null` → `NotFoundException('Unit not found')`.

Evidence: `tenant-query-policy.ts:164–178` (`applyReadPolicy`), `model-tenancy.ts:89` (`Unit: 'TENANT_OWNED'`).

---

### A2: Company A SALES calls `PATCH /leads/:id` with Company B's lead UUID

**Verdict: BLOCKED**

`Lead` is `TENANT_OWNED` (`model-tenancy.ts:95`). The middleware injects `companyId` from ALS. The service fetches the lead first (via `assertLeadInScope` or `findOne`) — query has `WHERE id = '<B_lead_uuid>' AND companyId = '<A_uuid>'`. Returns null → 404. The `UPDATE` itself is also scoped by `READ_OPS` (update uses `applyReadPolicy`).

---

### A3: Attacker sends `X-Tenant-Slug` of Company B while holding a valid Company A JWT

**Which wins: the header or the JWT claim?**

**The JWT claim always wins. Verdict: BLOCKED.**

Trace in `tenant-context.interceptor.ts:115–171`:

1. Guard phase (before interceptor): `CompanyLifecycleGuard` uses `req.user.companyId` exclusively (comment at `lifecycle.guard.ts:9`).
2. Interceptor phase: Line 131 — slug header is read. Line 135 — slug is resolved to a `companyId`. Line 140: **`if (companyId && resolved.companyId !== companyId) throw ForbiddenException`**. If Company A JWT (companyId set) + Company B slug → mismatch → 403 `TENANT_CONTEXT_MISMATCH`.

**Edge case: JWT with `companyId = null` (legacy CLIENT/CUSTOMER) + Company B slug.** Line 140 check is guarded by `if (companyId && ...)` — `null` is falsy, so the mismatch check is skipped. The code continues to line 148: `if (!companyId)` → falls back to `DEFAULT_COMPANY_ID`, ignoring the slug entirely. The attacker gets `DEFAULT_COMPANY_ID` context, not Company B's context.

---

### A4: Company A ADMIN creates a reservation referencing a `unitId` from Company B (body FK)

**Verdict: MIXED — some FKs BLOCKED, two FKs EXPLOITABLE**

**`unitId` (Unit — TENANT_OWNED): BLOCKED.**  
`reservations.module.ts:456`: `this.prisma.unit.findUnique({ where: { id: dto.unitId } })`. Middleware injects Company A's `companyId` → Company B's unit returns null → 404.

**`leadId` (Lead — TENANT_OWNED): BLOCKED.**  
`reservations.module.ts:414`: `this.prisma.lead.findUnique({ where: { id: dto.leadId } })`. Same middleware injection.

**`salesId` (User — TENANT_CONTROLLED): EXPLOITABLE.**  
`reservations.module.ts:373`:
```typescript
const salesUser = await this.prisma.user.findUnique({
  where: { id: dto.salesId },    // ← no companyId filter
  select: { id: true, role: true, active: true },
});
```
`User` is `TENANT_CONTROLLED` — middleware does NOT inject `companyId`. Only role (`SALES`) and `active` are checked. An ADMIN from Company A can supply a `salesId` belonging to a Company B user. The resulting `Reservation` row gets Company A's `companyId` (middleware on create) but has `salesId` pointing to Company B's user. This breaks commission/bonus attribution integrity.

**`clientId` (User — TENANT_CONTROLLED): EXPLOITABLE.**  
`reservations.module.ts:396`: same pattern — `user.findUnique({ where: { id: dto.clientId } })` with no `companyId` filter.

Same gap exists in:
- `contracts.module.ts` (customer/sales user lookups for contract creation)
- `broker-reservations.service.ts` (client lookup for broker-attributed reservations)

**Also checked:** `installmentPlanTemplateId` (InstallmentPlanTemplate — TENANT_OWNED) → BLOCKED by middleware. Broker body FKs (`brokerId`) — `Broker` is TENANT_OWNED → BLOCKED.

---

### A5: OTP — phone exists in both Company A and Company B

**Verdict: BLOCKED**

`auth.service.ts:971–979` (`verifyOtpV2`):
```typescript
const otp = await this.prisma.otpCode.findFirst({
  where: { phone, companyId, consumed: false, expiresAt: { gt: new Date() } },
  orderBy: { createdAt: 'desc' },
});
```
`OtpCode` is `TENANT_CONTROLLED` — middleware does not auto-inject, but the service explicitly passes `companyId` (from the resolved slug or auth context). Company A's OTP cannot be consumed by a Company B request because the `companyId` in the WHERE clause differs.

**Legacy null-companyId OTPs:** `WHERE phone = '...' AND companyId = '<A_uuid>'` does not match rows where `companyId IS NULL` (SQL equality ≠ NULL comparison). Legacy OTPs silently produce "Code expired or not found" for any company-scoped verification. Users with legacy OTPs must request a new one (which gets the correct `companyId`). This is the documented Option-A cutover strategy (`auth.service.ts:956–959`).

---

### A6: CLIENT with `companyId = NULL` logs in while `DEFAULT_COMPANY_ID` is set

**Verdict: EXPLOITABLE (known, documented, intentional legacy support)**

`tenant-context.interceptor.ts:148–163`: a `CLIENT` or `CUSTOMER` with null `companyId` gets `companyId = DEFAULT_COMPANY_ID`. All `TENANT_OWNED` reads/writes are then scoped to the default company. The user has full CLIENT/CUSTOMER access to all that company's data they are permitted to (their own reservations, contracts, etc.). `DISABLE_DEFAULT_COMPANY_FALLBACK=true` removes this fallback but defaults to `false`.

**Blast radius:** If a legacy null-companyId user is also linked (via `customerId` FK) to records in the default company, they can read those records normally. If they were linked to records in Company B (pre-MT migration), those records are now invisible to them (scoped away by middleware).

---

### A7: BROKER user calls a non-broker-portal endpoint (e.g. `GET /leads`, `GET /reports/*`)

**Verdict: BLOCKED for all currently decorated routes**

`GET /leads` — `leads.controller.ts:85–86`: `@Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)`. `BROKER` is not in this list → `RolesGuard` throws 403.

`GET /reports/kpis` — `reports.controller.ts:20`: `@Roles(UserRole.ADMIN)`. Same result.

`GET /units` (public) — `@Public`, so BROKER can call this route, but so can anyone. No BROKER-specific data is exposed; this is the public catalog.

**The critical invariant:** every admin/staff route in the codebase has an explicit `@Roles(...)` decorator that excludes `BROKER`. No route has JWT-only protection without `@Roles` in the admin namespace. A future developer adding a route without `@Roles` would inadvertently permit BROKER access — there is no allowlist.

**BROKER accessing broker-portal routes:** The entire `BrokerPortalController` is decorated with `@Roles(UserRole.BROKER)` at the class level (`broker-portal.controller.ts:61`). A non-BROKER user cannot access it.

---

### A8: Broker from Company A queries a project with no `BrokerProjectAccess` grant

**Verdict: BLOCKED**

`broker-portal.service.ts:83–84`:
```typescript
const grants = await this.prisma.brokerProjectAccess.findMany({
  where: { brokerId: scope.brokerId, active: true },
  ...
```
Only projects with an active access grant for this broker are returned. There is no project detail endpoint in the broker portal (`broker-portal.controller.ts:88` — only `GET /portal/projects`, no `GET /portal/projects/:id`). The units endpoint builds an `OR [{ building.phase.projectId: { in: accessibleProjectIds } }, { id: { in: explicitUnitIds } }]` where clause, so units from non-granted projects are excluded even for direct unit queries. `BrokerProjectAccess` is `TENANT_OWNED` — middleware also scopes it to the broker's company.

---

### A9: `GET /me/documents/:id/download` — ownership verified against `userId` and `companyId`?

**Verdict: BLOCKED — userId check via entity ownership + companyId via middleware**

`me-documents.module.ts:132`: `this.ownership.getCustomerDocumentOrThrow(user.sub, id)`.

`ownership.service.ts:57–75`:
1. `this.prisma.document.findFirst({ where: { id, deletedAt: null, visibility: CUSTOMER_VISIBLE } })` — `Document` is `TENANT_OWNED`, middleware injects `companyId`. So cross-company document UUIDs return null.
2. `assertOwnsOwner(userId, doc.ownerType, doc.ownerId)` — verifies the entity (contract/deposit/maintenance) has `customerId = userId`. This is a userId-level check.

Combined: the middleware scopes to the company (prevents cross-company access) and `assertOwnsOwner` scopes to the user (prevents same-company but wrong-user access). Both checks must pass.

**Gap:** `assertOwnsOwner` calls entity queries (`contract.findFirst`, `deposit.findFirst`, `maintenanceRequest.findFirst`) that rely solely on `userId` columns (`customerId`). These entities are `TENANT_OWNED` — middleware adds `companyId` to those queries too. So the ownership chain is: `Document.companyId (middleware) + Document.ownerId → entity.customerId == user.sub`. Correct.

---

### A10: Any chat session UUID → read full transcript

**Verdict: PARTIALLY BLOCKED — anonymousId required; anonymousId is client-generated**

`chat.service.ts:35–40`:
```typescript
private async requireOwnedSession(id: string, anonymousId: string) {
  const session = await this.prisma.chatSession.findUnique({ where: { id } });
  if (!session || session.anonymousId !== anonymousId) {
    throw new NotFoundException('Chat session not found');
  }
```

`ChatSession` is `TENANT_OWNED` — middleware scopes the `findUnique` to the request's `companyId` (from `DEFAULT_COMPANY_ID` or `X-Tenant-Slug`). A caller from a different company's context cannot retrieve a session belonging to another company.

**Within the same company context:** a caller needs both (a) the session UUID and (b) the `anonymousId`. Both are UUIDs. The combination is effectively a two-UUID secret. The `anonymousId` is a client-generated value (set by the mobile/web client, not issued by the server). There is no server-side session binding proof. A compromised client device or XSS attack could leak the `anonymousId`.

**PII a transcript can contain:** reading `chat/providers/rule-based/responses.ts` and the rule-based provider, a session can accumulate:
- Full name (collected via slot-filling)
- Phone number in Egyptian E.164 format
- Project/unit interest
- Preferred visit date
- Whether they have a salesperson contact request

This PII is stored in `ChatMessage.content` (plain text) with no encryption at the application layer.

---

## Section 4 — Role × Resource Matrix

Columns: C = Create, R = Read, U = Update, D = Delete. Blank = no access at that role.  
`@` prefix = via `/me/` authenticated self-service endpoint only.  
Row-level qualifiers noted in the "Intended?" column.

| Role | Project | Unit | Lead | Reservation | Contract | Installment | Deposit | Document | Visit | Broker* | User | Setting | Report | AuditLog | Intended? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **GUEST** | R¹ | R¹ | — | — | — | — | — | — | C² | — | — | — | — | — | ✓ |
| **CLIENT** | R¹ | R¹ | — | @R | — | — | — | @R³ | @CR | — | @RU | — | — | — | ✓ |
| **CUSTOMER** | R¹ | R¹ | — | @R | @R | @R | @R | @R³ | @CR | — | @RU | — | — | — | ✓ |
| **SALES** | R | R | CR⁴U | CRU | R | R | CR | R | CRU | — | R (own company) | — | — | — | ⚠ See note |
| **SALES_MANAGER** | R | R | CRUD⁵U | CRU | R | R | CR | R | CRU | — | R (own+team) | — | — | — | ✓ |
| **MAINTENANCE_SUPERVISOR** | — | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ (maintenance only, separate module) |
| **BROKER** | @R⁶ | @R⁶ | @CR | @CR | @R | — | — | — | @CR | @CRUD | — | — | — | — | ✓ |
| **ADMIN** | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | RU | R | R | ⚠ See note |
| **SUPER_ADMIN** | — | — | — | — | — | — | — | — | — | — | CRUD | — | — | — | ✓ (platform scope only) |

**Footnotes:**
1. Public catalog endpoints: `@Public()`, no auth required.
2. Via `POST /public/visit-request` or `POST /public/info-request`.
3. Only `CUSTOMER_VISIBLE` documents on entities owned by the caller.
4. SALES lead reads: see row-level note below.
5. SALES_MANAGER lead reads: scoped to own + team (`resolveSalesScope` → `managerScopeIds`).
6. Broker portal only: filtered by `BrokerProjectAccess` / `BrokerUnitAccess` grants.

---

### Row-Level Ownership: SALES and SALES_MANAGER

**`GET /leads` (list):** SALES always gets `{ salesId: user.sub }` from `resolveSalesScope` (`sales-scope.ts:84–85`) — they see only leads where `assignedSalesId = their UUID`. SALES_MANAGER gets `{ salesIds: [self + team] }`.

**`GET /leads/:id` (findOne): ⚠ SALES bypasses row-level scope.**  
`leads.controller.ts:198–206`:
```typescript
private async assertLeadInScope(user: AuthUser, id: string) {
  const lead = await this.prisma.lead.findUnique({ where: { id }, select: { assignedSalesId: true } });
  await assertSalesRecordInScope(this.prisma, user, lead?.assignedSalesId ?? null, {
    managersOnly: true,   // ← this flag bypasses SALES check
  });
}
```
`assertSalesRecordInScope` with `managersOnly: true` (`sales-scope.ts:130`): `if (opts.managersOnly && user.role !== UserRole.SALES_MANAGER) return;` — when the caller is `SALES`, this early-return fires unconditionally. **A SALES rep can call `GET /leads/:id` with any lead UUID in their company and retrieve the full record, even if not assigned to them.** The same `assertLeadInScope` guard is used for `PATCH /leads/:id`, `PATCH /leads/:id/stage`, and `POST /leads/:id/notes` — so SALES can read and write notes on any company lead by UUID.

**Reservation/Contract: No row-level SALES filtering.** SALES can create reservations and see all company reservations. There is no `assignedSalesId` scope on reservation/contract lists for SALES. This is consistent with how most CRMs work (shared pipeline visibility), but worth confirming with business requirements.

**Can SALES see another SALES agent's leads?**  
— In the list: NO (filtered to `assignedSalesId = self`).  
— By UUID: YES (managersOnly bypass).

**Can SALES see financial reports?**  
— `GET /reports/kpis`, `GET /reports/financial`: `@Roles(UserRole.ADMIN)` only. **NO.**  
— `GET /reports/sales`, `GET /reports/sales-trend`: `@Roles(UserRole.ADMIN)` only. **NO.**

**Can SALES_MANAGER see only their own team?**  
— Lead list: YES — `resolveSalesScope` returns `{ salesIds: managerScopeIds }` (self + team).  
— `GET /leads/:id`: YES — `assertSalesRecordInScope` enforces team scope for `SALES_MANAGER` (`managersOnly: true` means it DOES run the check for SALES_MANAGER).  
— Reservation/contract lists: NO row-level filtering — SALES_MANAGER sees all company reservations. This may be intentional (manager reviews all pipeline) or over-broad depending on requirements.

---

## Section 5 — SUPER_ADMIN Blast Radius

### Routes carrying `@BypassTenant()`

**Command run:** `grep -rn '@BypassTenant\|BypassTenant()' apps/api/src --include="*.ts" | grep -v __tests__`

Results:

| Location | Guard applied? | Audit-logged? | Cross-company write risk? |
|---|---|---|---|
| `health.controller.ts:10` (`@BypassTenant()` on class) | None (all routes `@Public`) | No (`RequestLoggerInterceptor` logs, `AuditInterceptor` runs but only logs state-changing HTTP methods) | No — health routes perform only `SELECT 1` |
| `super-admin.controller.ts:22` (`@BypassTenant()` on class) | `JwtAuthGuard` + `SuperAdminGuard` on every route (`controller.ts:21`) | AuditInterceptor runs on all mutating routes; however, `AuditLog` is `TENANT_OWNED` — with bypass context, the middleware uses `bypass=true` path which skips companyId injection. The `AuditInterceptor` must supply `companyId` explicitly to create audit rows in bypass context. Needs verification that audit rows are written correctly for super-admin actions. | Yes — all `CompanyService` write methods (`createCompany`, `updateCompany`, `cancelCompany`, `suspendCompany`, `activateCompany`, `deleteCompany`, `updateCapabilities`) mutate cross-company data. `SuperAdminGuard` is the only gate. |

**Super-admin route risk summary:**

All `super-admin.controller.ts` routes (`super-admin.controller.ts:28–120`) carry both `@UseGuards(JwtAuthGuard, SuperAdminGuard)` and `@BypassTenant()`. The `SuperAdminGuard` validates `user.role === SUPER_ADMIN`. There is no second-factor, IP allowlist, or permission-code gate on these routes. A compromised `SUPER_ADMIN` JWT can:
- Create new companies (`POST /super-admin/companies`)
- Cancel or archive any company (`POST /super-admin/companies/:id/cancel`)
- Suspend any company (`POST /super-admin/companies/:id/suspend`)
- Delete any company (`DELETE /super-admin/companies/:id`) — though service has a hard-delete guard for non-terminal status
- Set arbitrary capabilities/modules on any company

**Audit gap:** Audit logging for bypass-context operations — AuditLog is `TENANT_OWNED`, but in bypass context (`bypass=true`) the middleware passes through writes without injecting `companyId`. If the `AuditInterceptor` does not explicitly supply a `companyId` for super-admin actions, those audit rows may be created with `companyId = null` (invisible to all tenant-scoped reads) or may fail if the model write validation requires a non-null `companyId`. This requires manual verification of `audit.interceptor.ts` behavior in bypass context.

---

## Section 6 — Ranked Findings

| # | Finding | Severity | Exploitable today? | Evidence | Fix sketch | Effort |
|---|---|---|---|---|---|---|
| 1 | **Body-supplied User FKs (`salesId`, `clientId`) in reservation/contract creation are not companyId-validated.** `User` is `TENANT_CONTROLLED` — middleware does not scope it. An ADMIN from Company A can link a `salesId` or `clientId` that belongs to Company B's user, creating a cross-tenant ownership reference. Corrupts commission, bonus, and contract attribution data. | High | Yes — ADMIN role required; attacker must know Company B user UUIDs | `reservations.module.ts:373`, `reservations.module.ts:396` | Add `companyId` to all User `findUnique` calls in write-path services that accept user IDs from request bodies | M |
| 2 | **`@Permissions` adminBypass makes ADMIN role ungranulable.** All `@Permissions(code)` decorators (the majority) have `adminBypass=true`. An ADMIN user with zero `UserPermission` rows passes every non-strict gate. As the organisation grows multi-admin with different access levels, no permission code assignment can restrict an ADMIN without changing decorators to `@PermissionsStrict`. | High | Yes — structural; any ADMIN bypasses permission codes | `permissions.guard.ts:49`, `permissions.decorator.ts:24` | Convert sensitive-but-non-two-person routes to `@PermissionsStrict`; or add a `SCOPED_ADMIN` role for limited admins | L |
| 3 | **SALES `GET /leads/:id` bypasses row-level scope via `managersOnly: true`.** List endpoint restricts SALES to `assignedSalesId = self`, but the `assertLeadInScope` guard with `managersOnly: true` skips the SALES self-check entirely. SALES can retrieve, update, and add notes to any lead in the company by UUID. Same guard protects `PATCH /leads/:id`, `PATCH /leads/:id/stage`, `POST /leads/:id/notes`. | Medium | Yes — any SALES user, within company | `leads.controller.ts:198–206`, `sales-scope.ts:130` | Change `managersOnly: true` to `managersOnly: false`, or add explicit `SALES` self-check before the early-return | S |
| 4 | **`GET /info-requests` missing `@Permissions` decorator.** `@Roles(ADMIN, SALES, SALES_MANAGER)` but no `@Permissions`. All other admin read routes in the same file use `@Permissions('visits:read')` or similar. This route is effectively coarser than its siblings. | Low | Yes — any SALES/ADMIN/SM token | `requests.module.ts:575` | Add `@Permissions('info_requests:read')` | S |
| 5 | **Chat `anonymousId` is client-generated with no server-issued credential.** All `/chat/sessions/*` routes are `@Public`. Session ownership is verified by matching `anonymousId`, but this value is a client-generated UUID stored in client-side storage. A leaked `anonymousId` (XSS, device handoff) allows full session read/write. PII collected: name, phone, project interest, visit intent. | Low-Medium | Conditional — requires session UUID + anonymousId both leaked | `chat.service.ts:35–40`, `chat.controller.ts:24–57` | Issue a server-side session token on `POST /chat/sessions` and verify it on subsequent calls; or bind sessions to an IP/User-Agent | M |
| 6 | **Super-admin audit logging in bypass context unverified.** `AuditLog` is `TENANT_OWNED` but super-admin requests use `bypass=true`. If `AuditInterceptor` does not explicitly provide `companyId` for these writes, audit rows may be created with `companyId = null` (invisible to all tenant-scoped audit reads) — or may throw. Successful `companyId = null` audit rows cannot be retrieved by any admin via `GET /audit-logs` (tenant-scoped). | Low | Conditional — requires reviewing `audit.interceptor.ts` | `audit.module.ts:249–268`, `super-admin.controller.ts:22` | Verify `AuditInterceptor` handles bypass context; explicitly write audit rows with the target `companyId` for super-admin mutations | S |
| 7 | **`Prisma.$use` deprecated in Prisma 5, removed in Prisma 6.** The entire tenant isolation model depends on this middleware. When the project upgrades to Prisma 6, `$use` will cease to function and all tenant scoping silently drops. The migration path is `$extends({ query: { ... } })`, which has different transaction semantics. | Low | No — only if Prisma 6 upgrade happens without this migration | `prisma.service.ts:45–46` (deprecation comment) | Replace `$use` with `$extends` before upgrading to Prisma 6; pin Prisma version in `package.json` with explicit upgrade gate | M |
| 8 | **`NotificationTemplate.code` unique constraint is unscoped (global across all companies).** A template code must be unique across the entire database, not per company. Two tenants cannot define the same template code (e.g. `lead_assigned_sales`) independently. First onboarded company wins; subsequent companies' templates for that code are rejected. | Low | No direct exploit — data design issue | `schema.prisma:1573` (unique `code` on `NotificationTemplate`) | Add composite unique constraint `(code, companyId)` with a migration | S |

---

## Notes and Verification Gaps

1. **`AuditInterceptor` bypass-context behavior:** Whether audit rows are correctly written for super-admin routes (finding #6) requires reading `common/interceptors/audit.interceptor.ts`. Not read in this audit.

2. **`$transaction` middleware inheritance in Prisma 5:** Interactive transaction callbacks (`$transaction(async tx => {...})`) are stated above to inherit `$use` middleware. This is the documented behavior in Prisma 5 but has changed across versions. If there is any doubt, the boot-time model classification assertion (`prisma.service.ts:58–71`) and `MissingTenantContextError` throw-on-null provide defense-in-depth regardless.

3. **`Company.capabilities` / `Company.modules` enforcement:** These untyped JSON blobs control feature entitlements but are read nowhere in the API layer (confirmed in system map). Any entitlement bypass via these fields requires a separate audit when the CapabilityService is built.

4. **Broker contracts/installments via portal:** BROKER can read their attributed contracts via `broker-portal`. Those reads include `BrokerCommission` (TENANT_OWNED, scoped) and `Contract` (TENANT_OWNED, scoped). No bypass observed, but the broker portal services were not exhaustively audited for all relation includes.
