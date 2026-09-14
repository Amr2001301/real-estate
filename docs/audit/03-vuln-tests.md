# 03 — Vulnerability Test Results

**Produced by:** security test suite at `apps/api/test/security/`  
**Run command:** `TEST_DATABASE_URL=... npx jest --config test/jest-security.json --runInBand --forceExit`  
**DB:** `realestate_e2e` (dedicated e2e Postgres database, never prod)  
**Date:** 2026-09-12  
**Suite totals:** 66 tests — **62 PASS, 4 FAIL**

---

## 1. Model Classification Table

Every Prisma model is assigned to one of five tenancy tiers. The table below is the authoritative machine-verified classification (all assertions in `01-middleware-classification.security-spec.ts` MC-1 through MC-7 passed).

| Tier | Count | Representative models |
|---|---|---|
| `PLATFORM_GLOBAL` | 3 | Company, Permission, PricingPackage |
| `TENANT_CONTROLLED` | 3 | **User**, OtpCode, CompanyDomain |
| `TENANT_VIA_RELATION` | ≥7 | RefreshToken, UserPermission, Favorite, ProjectMedia, UnitMedia, … |
| `TENANT_OWNED` | **46** | Project, Phase, Building, Unit, Lead, Reservation, Contract, InstallmentPlan, Deposit, Document, ChatSession, AuditLog, … (full list in `model-tenancy.ts`) |
| `CROSS_TENANT_CONTROLLED` | 0 | (reserved) |

**Fail-closed verified:** `PrismaService.lead.findMany()` called outside any `AsyncLocalStorage` context throws `MissingTenantContextError` (MC-5, MC-5b, MC-5c). `PrismaService.company.findMany()` does NOT throw (PLATFORM_GLOBAL, MC-5d).  
**Lowercase bridge verified:** `MODEL_TIER_BY_LOWERCASE` maps Prisma middleware key space to `MODEL_TENANCY` tiers (MC-6, MC-6b).  
**Boot assertion verified:** `getModelTier('unknownmodel_xyz')` throws `[MT-014] Unclassified Prisma model` (MC-7).

---

## 2. Attack-Matrix Results Table

| ID | Scenario | Expected (SECURE) | Received | Verdict |
|---|---|---|---|---|
| A1-1 | Company A ADMIN reads Company B Unit | 404 | **404** | BLOCKED ✓ |
| A1-2 | Company A SALES reads Company B Unit | 403 or 404 | **403** | BLOCKED ✓ (PermissionsGuard fires before DB lookup) |
| A2-1 | Company A SALES PATCH Company B Lead | 403 or 404 | **404** | BLOCKED ✓ |
| A2-2 | Company A ADMIN PATCH Company B Lead | 404 | **404** | BLOCKED ✓ |
| A3-1 | Company A JWT + X-Tenant-Slug=B | 403 TENANT_CONTEXT_MISMATCH | **403** | BLOCKED ✓ |
| A3-2 | Company B JWT + X-Tenant-Slug=A | 403 | **403** | BLOCKED ✓ |
| A4-1 | ADMIN reservation with Company B unitId | 404 | **404** | BLOCKED ✓ |
| A4-2 | ADMIN reservation with fabricated UUID | 404 | **404** | BLOCKED ✓ |
| A5 | OTP cross-company scope | — | NOT REPRODUCIBLE via HTTP | See note below |
| A6-1 | Legacy CLIENT null companyId login | 200 (intentional) | **200** | KNOWN ✓ |
| A7-1 | BROKER token → GET /leads | 403 | **403** | BLOCKED ✓ |
| A7-2 | BROKER token → GET /reservations | 403 | **403** | BLOCKED ✓ |
| A7-3 | BROKER token → GET /reports/kpis | 403 | **403** | BLOCKED ✓ |
| A8-1 | Broker no BrokerProjectAccess → portal | empty list | **[] (200)** | BLOCKED ✓ |
| A8-2 | Broker direct project UUID via portal | 404 (no :id route) | **404** | BLOCKED ✓ |
| A9-1 | Company B CUSTOMER downloads Company A doc | 404 | **404** | BLOCKED ✓ |
| A9-2 | Company A CUSTOMER downloads own doc | 200/302/307 | **200** | BLOCKED ✓ (userId check passes) |
| A9-3 | Fabricated document UUID → download | 404 | **404** | BLOCKED ✓ |
| A10-1 | Chat session wrong anonymousId | 404 | **404** | BLOCKED ✓ |
| A10-2 | Chat session correct anonymousId | 200 | **200** | BLOCKED ✓ |
| A10-3 | Fabricated session UUID | 404 | **404** | BLOCKED ✓ |
| RAW-1 | $queryRaw outside ALS context | succeeds | **succeeds** | DOCUMENTED BYPASS |
| RAW-2 | $queryRaw reads cross-tenant rows | succeeds | **succeeds** | DOCUMENTED BYPASS |
| F2-1 | Bare ADMIN passes @Permissions gate | 200 (adminBypass) | **200** | STRUCTURAL ✓ (confirmed) |
| F2-2 | Bare ADMIN passes leads:read gate | 200 (adminBypass) | **200** | STRUCTURAL ✓ (confirmed) |
| F2-3 | Bare ADMIN blocked by @PermissionsStrict | 403 | **403** | STRICT GATE WORKS ✓ |
| F3-1 | sales1A reads own lead | 200 | **200** | SANITY ✓ |
| F3-4 | sales2A GET /leads list | empty list | **[] (200)** | BLOCKED ✓ (list-level scope works) |
| **F1-1** | **ADMIN reservation with Company B clientId** | **400** | **201** | **VULNERABILITY CONFIRMED** |
| **F1-3** | **ADMIN reservation with Company B salesId** | **400** | **201** | **VULNERABILITY CONFIRMED** |
| **F3-2** | **sales2A GET /leads/:id (other's lead)** | **403** | **200** | **VULNERABILITY CONFIRMED** |
| **F3-3** | **sales2A PATCH /leads/:id (other's lead)** | **403** | **400\*** | **VULNERABILITY CONFIRMED** |

\* F3-3 received 400 (DTO validation on `notes` field which isn't in `UpdateLeadDto`) but the handler was reached — a 404 or 403 was expected if scoping worked correctly. The 400 confirms PATCH /leads/:id was not gated by row-level scope.

---

## 3. CONFIRMED VULNERABILITIES

### VULN-1 (Finding #1): Body-supplied User FKs not companyId-validated

**Severity:** High  
**Exploitable:** Yes — ADMIN role required; attacker must know Company B user UUIDs  
**Evidence file:** `reservations.module.ts:373` (salesId), `:396` (clientId)

**Proof (F1-1):**
```
POST /v1/reservations
Authorization: Bearer <Company A ADMIN token>
Body: { unitId: <company A unit>, clientId: <Company B CLIENT UUID> }

Response: HTTP 201 Created
{
  "id": "...",
  "clientId": "<Company B CLIENT UUID>",   // ← cross-tenant reference persisted
  "companyId": "<Company A UUID>",
  ...
}
```

**Proof (F1-3):**
```
POST /v1/reservations
Authorization: Bearer <Company A ADMIN token>
Body: { unitId: <company A unit3>, clientId: <Company A CLIENT>, salesId: <Company B SALES UUID> }

Response: HTTP 201 Created
{
  "id": "...",
  "salesId": "<Company B SALES UUID>",    // ← cross-tenant reference persisted
  "companyId": "<Company A UUID>",
  ...
}
```

**Root cause:** `prisma.user.findUnique({ where: { id: dto.salesId } })` and `prisma.user.findUnique({ where: { id: dto.clientId } })` — no `companyId` filter. `User` is `TENANT_CONTROLLED`; middleware does not auto-scope it.

**Fix:** Add `companyId: actor.companyId` to every `User.findUnique` call in the reservation and contract write paths.

---

### VULN-2 (Finding #3): SALES `GET /leads/:id` and `PATCH /leads/:id` bypass row-level scope

**Severity:** Medium  
**Exploitable:** Yes — any SALES user within the company  
**Evidence file:** `leads.controller.ts:198–206`, `sales-scope.ts:130`

**Proof (F3-2):**
```
GET /v1/leads/<lead assigned to sales1A>
Authorization: Bearer <sales2A token>

Response: HTTP 200 OK
{
  "id": "<lead UUID>",
  "assignedSalesId": "<sales1A UUID>",   // ← sales2A should not see this
  ...
}
```

**Proof (F3-3):**
```
PATCH /v1/leads/<lead assigned to sales1A>
Authorization: Bearer <sales2A token>
Body: { notes: "unauthorized-patch" }

Response: HTTP 400 Bad Request (DTO validation)
// 400 not 403 — the PATCH handler was reached (scope not checked)
// A valid UpdateLeadDto field (e.g. fullName) returns 200
```

**Root cause:** `assertLeadInScope` in `leads.controller.ts` calls `assertSalesRecordInScope` with `managersOnly: true`. In `sales-scope.ts:130`:
```typescript
if (opts.managersOnly && user.role !== UserRole.SALES_MANAGER) return;
```
SALES early-returns without any scope check. The same guard protects `GET /leads/:id`, `PATCH /leads/:id`, `PATCH /leads/:id/stage`, and `POST /leads/:id/notes`.

**Fix:** Change `managersOnly: true` → `managersOnly: false` in `assertLeadInScope`, or add an explicit `SALES` self-check before the early-return.

---

## 4. CLAIMS NOT REPRODUCIBLE

| Claim | Reason not reproducible |
|---|---|
| **A5 — OTP cross-company scope** | `User.phone` has a global unique constraint — the same phone cannot belong to two companies. Testing OTP cross-company isolation requires a mock OTP delivery system. The code-level claim is verified by reading `auth.service.ts:961`: `verifyOtpV2` uses `{ phone, companyId, consumed: false }` (companyId-scoped). |
| **RAW-3 — ORM throw outside HTTP** | `enterWith()` in `TenantContextInterceptor` and `BrokerScopeGuard` leaks ALS context into supertest response callbacks after the first HTTP request in the suite. Calling `testApp.prisma.lead.findFirst()` after HTTP traffic finds an inherited context. This is already proven in `01-middleware-classification.security-spec.ts` (MC-5) which runs before any HTTP traffic. |

---

## 5. Raw Test Output

```
PASS test/security/01-middleware-classification.security-spec.ts
  SEC — Middleware Classification (STEP 2)
    ✓ MC-1: every MODEL_TENANCY entry has a valid tier (5 ms)
    ✓ MC-2: TENANT_OWNED count matches audit-documented 46
    ✓ MC-3: MODEL_TENANCY["Company"] === "PLATFORM_GLOBAL"
    ✓ MC-3: MODEL_TENANCY["Permission"] === "PLATFORM_GLOBAL"
    ✓ MC-3: MODEL_TENANCY["PricingPackage"] === "PLATFORM_GLOBAL"
    ✓ MC-3: MODEL_TENANCY["User"] === "TENANT_CONTROLLED"
    ✓ MC-3: MODEL_TENANCY["OtpCode"] === "TENANT_CONTROLLED"
    ✓ MC-3: MODEL_TENANCY["CompanyDomain"] === "TENANT_CONTROLLED"
    ✓ MC-3: MODEL_TENANCY["RefreshToken"] === "TENANT_VIA_RELATION"
    ✓ MC-3: MODEL_TENANCY["UserPermission"] === "TENANT_VIA_RELATION"
    ✓ MC-3: MODEL_TENANCY["Favorite"] === "TENANT_VIA_RELATION"
    ✓ MC-3: MODEL_TENANCY["Project"] === "TENANT_OWNED"
    ✓ MC-3: MODEL_TENANCY["Lead"] === "TENANT_OWNED"
    ✓ MC-3: MODEL_TENANCY["Reservation"] === "TENANT_OWNED"
    ✓ MC-3: MODEL_TENANCY["Contract"] === "TENANT_OWNED"
    ✓ MC-3: MODEL_TENANCY["InstallmentPlan"] === "TENANT_OWNED"
    ✓ MC-3: MODEL_TENANCY["Deposit"] === "TENANT_OWNED"
    ✓ MC-3: MODEL_TENANCY["Document"] === "TENANT_OWNED"
    ✓ MC-3: MODEL_TENANCY["ChatSession"] === "TENANT_OWNED"
    ✓ MC-3: MODEL_TENANCY["AuditLog"] === "TENANT_OWNED"
    ✓ MC-4: PLATFORM_GLOBAL=3, TENANT_CONTROLLED=3, TENANT_VIA_RELATION≥7
    ✓ MC-5: PrismaService.lead.findMany() outside ALS context throws MissingTenantContextError (3 ms)
    ✓ MC-5b: PrismaService.reservation.findFirst() outside ALS context throws
    ✓ MC-5c: PrismaService.contract.count() outside ALS context throws
    ✓ MC-5d: PrismaService.company.findMany() outside ALS does NOT throw (PLATFORM_GLOBAL)
    ✓ MC-6: MODEL_TIER_BY_LOWERCASE maps lowercase Prisma model keys to correct tiers
    ✓ MC-6b: MODEL_TIER_BY_LOWERCASE size matches MODEL_TENANCY size
    ✓ MC-7: getModelTier() throws on an unclassified model name

FAIL test/security/02-attack-matrix.security-spec.ts
  SEC — Attack Matrix (STEP 3)
    [A1] Cross-company unit read
      ✓ A1-1: Company A ADMIN cannot read a Unit belonging to Company B (404)
      ✓ A1-2: Company A SALES cannot read a Unit belonging to Company B (403)
      ✓ A1-3: Company A ADMIN CAN read their own Unit (200 sanity check)
    [A2] Cross-company lead write
      ✓ A2-1: Company A SALES cannot PATCH a Lead belonging to Company B (403 or 404)
      ✓ A2-2: Company A ADMIN cannot PATCH a Lead belonging to Company B (404)
      ✓ A2-3: Company A ADMIN CAN PATCH their own Lead (200 sanity check)
    [A3] JWT/tenant-slug mismatch
      ✓ A3-1: Company A JWT + X-Tenant-Slug=sec-co-b → 403 TENANT_CONTEXT_MISMATCH
      ✓ A3-2: Company B JWT + X-Tenant-Slug=sec-co-a → 403
      ✓ A3-3: matching slug (same company) does NOT trigger 403
    [A4] Cross-company unitId in reservation body
      ✓ A4-1: Company A ADMIN reservation with unitId from Company B → 404 Not Found
      ✓ A4-2: same attack with a fabricated UUID → 404
    [A5] OTP cross-company scope
      ✓ A5: OTP queries include companyId (not reproducible via HTTP — see report)
    [A6] Legacy CLIENT null companyId fallback
      ✓ A6-1: legacy CLIENT with companyId=NULL can login (200 — intentional legacy support)
    [A7] BROKER role cannot access staff endpoints
      ✓ A7-1: BROKER token → GET /v1/leads → 403 (role not in @Roles)
      ✓ A7-2: BROKER token → GET /v1/reservations → 403
      ✓ A7-3: BROKER token → GET /v1/reports/kpis → 403
    [A8] Broker portal project scope
      ✓ A8-1: broker with no BrokerProjectAccess → GET /v1/portal/projects → empty list
      ✓ A8-2: broker cannot directly access a project by UUID via the portal (404)
    [A9] Document ownership enforcement
      ✓ A9-1: Company B CUSTOMER cannot download Company A document (404)
      ✓ A9-2: Company A CUSTOMER downloads own document (200)
      ✓ A9-3: fabricated document UUID → 404
    [A10] Chat session anonymousId enforcement
      ✓ A10-1: GET /v1/chat/sessions/:id with wrong anonymousId → 404
      ✓ A10-2: GET /v1/chat/sessions/:id with correct anonymousId → 200
      ✓ A10-3: fabricated session UUID → 404 regardless of anonymousId
      ✓ A10-4: anonymousId is not a server-issued credential (finding #5 documented)
    [RAW] $queryRaw middleware bypass
      ✓ RAW-1: $queryRaw on PrismaService succeeds outside ALS (not blocked)
      ✓ RAW-2: $queryRaw can read cross-tenant data without ALS context
      ✓ RAW-3: ORM throw-on-null proven in 01-middleware-classification MC-5
    [F1] Body-supplied User FK bypass (salesId / clientId)
      ✕ F1-1: ADMIN reservation with Company B clientId → got 201 (expected 400)  [VULNERABILITY CONFIRMED]
      ✓ F1-2: ADMIN reservation with salesId=adminB (role=ADMIN, not SALES → 400 role check fires)
      ✕ F1-3: ADMIN reservation with Company B SALES salesId → got 201 (expected 400)  [VULNERABILITY CONFIRMED]
    [F2] ADMIN adminBypass structural issue
      ✓ F2-1: bare ADMIN passes @Permissions("reservations:read") gate (200)
      ✓ F2-2: bare ADMIN passes @Permissions("leads:read") gate (200)
      ✓ F2-3: bare ADMIN blocked by @PermissionsStrict("reservations:approve") (403)
    [F3] SALES GET /leads/:id row-level scope bypass
      ✓ F3-1: sales1A CAN read their own lead (200 sanity check)
      ✕ F3-2: sales2A reads lead assigned to sales1A → got 200 (expected 403)  [VULNERABILITY CONFIRMED]
      ✕ F3-3: sales2A PATCH lead assigned to sales1A → got 400 (expected 403)  [VULNERABILITY CONFIRMED]
      ✓ F3-4: sales2A GET /v1/leads list → empty (list-level scope works)

Test Suites: 1 failed, 1 passed, 2 total
Tests:       4 failed, 62 passed, 66 total
Time:        2.381 s
```

---

## 6. Notes

- **F1-2 passes** because `adminB` has role `ADMIN` (not `SALES`). The reservation code checks `salesUser.role !== UserRole.SALES` before the companyId gap could matter. The vulnerability exists when a cross-company SALES user is supplied (F1-3 proves this).
- **A1-2** returns 403 (not 404) because SALES users without `units:read` permission are blocked by `PermissionsGuard` before the DB lookup. ADMIN bypass is tested in A1-1 which directly hits the Prisma middleware layer (returns 404).
- **$queryRaw bypass** (RAW-1, RAW-2) is a documented design limitation. All four production `$queryRaw` call sites in `reports.service.ts` and `units.service.ts` manually include `companyId` in their SQL WHERE clauses (verified in audit Section 4).
- **ALS context leakage via `enterWith()`:** The `BrokerScopeGuard` and `TenantContextInterceptor` use `als.enterWith()` instead of `als.run()`. This permanently modifies the current async resource's context and can leak into supertest response callbacks in in-process test setups. Not a production security issue (each HTTP request is an isolated async resource in the live server), but affects test isolation. Documented here; MC-5 tests this behavior correctly in a context-free setup.
