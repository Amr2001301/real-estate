# 12 — MT-012 Suppression Audit (commit 404f567)

**Date:** 2026-09-14  
**Commit under review:** `404f567` — "fix(lint): suppress pre-existing prisma.user MT-012 violations"  
**Reviewer:** manual audit of every `eslint-disable-next-line no-restricted-syntax` added in that commit

---

## 1. Why was this commit needed?

The MT-012 ESLint rule (the `no-restricted-syntax` selector that blocks direct
`prisma.user.*` access outside the allowlist) **did not exist at commit `3c7378c`**.
It was introduced by commit `e14eed0` (the security commit). Running
`git show 3c7378c:eslint.config.mjs | grep -c no-restricted-syntax` returns `2` —
both occurrences cover only `$queryRawUnsafe`; the `prisma.user` selector is absent.

When `e14eed0` added the rule, it immediately made 17 existing sites in the codebase
illegal. A follow-up commit `6a21dd1` added two new files from that commit
(`resolve-tenant-entity.ts`, `sales-scope.ts`) to the allowlist. The remaining 17
violations across 13 files were all in pre-existing code that predated the rule.
`404f567` was the clean-up pass to silence those failures so CI could go green.

**What made these files violate MT-012 now:** The rule was applied retroactively to
code that had already been written. None of the 13 files changed their own logic.

---

## 2. Full diff of 404f567

```diff
diff --git a/apps/api/src/modules/audit/audit.module.ts b/apps/api/src/modules/audit/audit.module.ts
@@ -129,7 +129,8 @@ class AuditService {
     const actors = actorIds.length
-      ? await this.prisma.user.findMany({
+      ? // eslint-disable-next-line no-restricted-syntax
+        await this.prisma.user.findMany({
           where: { id: { in: actorIds } },
           select: { id: true, fullName: true, email: true, role: true },

diff --git a/apps/api/src/modules/bonus/bonus.module.ts b/apps/api/src/modules/bonus/bonus.module.ts
@@ -462,6 +462,7 @@ export class BonusService {
     ] = await Promise.all([
+      // eslint-disable-next-line no-restricted-syntax
       this.prisma.user.findMany({ where: { id: inReps }, select: { id: true, fullName: true } }),
@@ -722,6 +723,7 @@ class BonusController {
     if (user.role === UserRole.ADMIN) {
+      // eslint-disable-next-line no-restricted-syntax
       return this.prisma.user.findMany({ where: { role: { in: [...] } }, ... });
     }
     const ids = await managerScopeIds(this.prisma, user.sub);
+    // eslint-disable-next-line no-restricted-syntax
     return this.prisma.user.findMany({ where: { id: { in: ids } }, ... });

diff --git a/apps/api/src/modules/broker-portal/broker-portal-team.service.ts ...
+    // eslint-disable-next-line no-restricted-syntax
     const existingUser = await this.prisma.user.findFirst({ where: { OR: [{email}, {phone}] } });
...
+        // eslint-disable-next-line no-restricted-syntax
         const clash = await this.prisma.user.findUnique({ where: { email: dto.email } });
...
+        // eslint-disable-next-line no-restricted-syntax
         const clash = await this.prisma.user.findUnique({ where: { phone: dto.phone } });

diff --git a/apps/api/src/modules/broker-users/broker-users.service.ts ...
+    // eslint-disable-next-line no-restricted-syntax
     const existingUser = await this.prisma.user.findFirst({ where: { OR: [{email}, {phone}] } });
...
+        // eslint-disable-next-line no-restricted-syntax
         const clash = await this.prisma.user.findUnique({ where: { email: dto.email } });
...
+        // eslint-disable-next-line no-restricted-syntax
         const clash = await this.prisma.user.findUnique({ where: { phone: dto.phone } });

diff --git a/apps/api/src/modules/deposits/deposits.service.ts ...
+      // eslint-disable-next-line no-restricted-syntax
       const staff = await this.prisma.user.findMany({ where: { role: { in: [ADMIN, SM] }, active: true } });

diff --git a/apps/api/src/modules/me-home/me-home.module.ts ...
+      // eslint-disable-next-line no-restricted-syntax
       this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),

diff --git a/apps/api/src/modules/notifications/notifications.module.ts ...
+      // eslint-disable-next-line no-restricted-syntax -- bulk role query, not an external-ID lookup; no IDOR risk
       const users = await this.prisma.user.findMany({ where: { role: { in: [...roles] }, active: true } });
...
+      // eslint-disable-next-line no-restricted-syntax -- bulk IDs supplied by this service, not from external input
       const usersWithLocale = await this.prisma.user.findMany({ where: { id: { in: ids } } });
...
+        // eslint-disable-next-line no-restricted-syntax -- broadcast to all active users (no external-ID IDOR risk)
         const users = await this.prisma.user.findMany({ where: { active: true } });
...
+    // eslint-disable-next-line no-restricted-syntax -- bulk role query, not an external-ID lookup; no IDOR risk
     const users = await this.prisma.user.findMany({ where: { role: { in: roles }, active: true } });

diff --git a/apps/api/src/modules/reports/reports.service.ts ...
+      // eslint-disable-next-line no-restricted-syntax
       this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
+      // eslint-disable-next-line no-restricted-syntax
       this.prisma.user.count({ where: { role: { in: [ADMIN, SALES, SM] } } }),

diff --git a/apps/api/src/modules/requests/requests.module.ts ...
+    // eslint-disable-next-line no-restricted-syntax -- lookup by phone/email (not external ID); dedup upsert pattern
     const byPhone = await this.prisma.user.findUnique({ where: { phone } });
+      // eslint-disable-next-line no-restricted-syntax -- same pattern as above
       const byEmail = await this.prisma.user.findUnique({ where: { email } });
+    // eslint-disable-next-line no-restricted-syntax -- user creation, not a read IDOR
     return this.prisma.user.create({ data: { role: 'CLIENT', ... companyId: getTenantContext()?.companyId ?? null } });
+        // eslint-disable-next-line no-restricted-syntax -- userId is the authenticated user's own ID (from JWT)
         const u = await this.prisma.user.findUnique({ where: { id: userId } });

diff --git a/apps/api/src/modules/reservations/reservations.module.ts ...
+    // eslint-disable-next-line no-restricted-syntax -- userId is the authenticated user's own ID; identity-resolution
     const contact = await this.prisma.user.findUnique({ where: { id: userId } });
...
+      // eslint-disable-next-line no-restricted-syntax -- phone-suffix scan for identity peers; no external-ID supplied
       const candidates = await this.prisma.user.findMany({ where: { phone: { contains: suffix } } });
...
+      // eslint-disable-next-line no-restricted-syntax -- canonical-email lookup for identity peers
       const byEmail = await this.prisma.user.findUnique({ where: { email: emailKey } });

diff --git a/apps/api/test/e2e/strict-permissions.e2e-spec.ts ...
-        const res = await (request(testApp.app.getHttpServer()) as any)
-          [method](url)
+        const res = await (request(testApp.app.getHttpServer()) as any)[method](url)
         (×2 — fixes no-unexpected-multiline)

diff --git a/apps/api/src/modules/auth/__tests__/otp-namespace-isolation.spec.ts ...
-const { createHash } = require('node:crypto');
+import { createHash } from 'node:crypto';

diff --git a/eslint.config.mjs ...
-    files: ['**/*.{spec,test}.{ts,tsx,js}', '**/*.e2e-spec.ts', '**/__tests__/**/*.{ts,tsx,js}'],
+    files: ['**/*.{spec,test}.{ts,tsx,js}', '**/*.e2e-spec.ts', '**/*.security-spec.ts', '**/__tests__/**/*.{ts,tsx,js}'],
```

---

## 3. Suppression-by-suppression table

> **Legend**
> — *Lookup key*: what value is in the `where` clause  
> — *companyId in where?*: whether the `prisma.user` query itself filters by tenant  
> — *Safe?*: verdict on whether the suppression is legitimate  
> — *Security test?*: whether a test in the security suite exercises this code path

| # | File : approx line | Query | Lookup key | companyId in where? | Why suppression is safe (or not) | Security test? |
|---|---|---|---|---|---|---|
| 1 | `audit.module.ts:132` | `findMany` | `id: { in: actorIds }` — IDs extracted from `auditLog.groupBy` output, which is middleware-scoped to the current tenant | No | The IDs originate from TENANT_OWNED AuditLog rows already filtered by the middleware. However, if a cross-tenant or platform-level actor (e.g. super-admin) appears in the current tenant's audit log, their user record can be resolved without a companyId check. Minor indirect leak, not a direct caller-controlled IDOR. **Safe enough for ADMIN-only dashboard, but the scope gap is real.** | No |
| 2 | `bonus.module.ts:465` | `findMany` | `id: { in: inReps }` — for ADMIN role, `repIds = [opts.salesId]` where `opts.salesId = query.salesId` (URL query param `?salesId=<uuid>`) | **No** | **❌ SUPPRESSION IS NOT SAFE.** `opts.salesId` comes directly from the request query string. An ADMIN can supply any UUID, including a user from another tenant. The query returns `{ id, fullName }` for that UUID with no companyId check. This is the definition of V-01 (cross-tenant direct object reference). The commit message says "not an external-ID lookup" — that is wrong for this specific call site. | No |
| 3 | `bonus.module.ts:726` | `findMany` | `role: { in: [SALES, SALES_MANAGER] }` | No | Role-only filter; no external ID supplied. Not an IDOR. Returns a list of sales actors across all tenants — a cross-tenant fan-out issue (should have companyId) but not a targeted entity-resolve attack. The missing tenant scope is a separate bug. | No |
| 4 | `bonus.module.ts:733` | `findMany` | `id: { in: ids }` where `ids = await managerScopeIds(prisma, user.sub)` | No | `managerScopeIds` uses `user.sub` (JWT) and queries `teamSalesIds(managerId)` without a companyId filter (also an MT-012 issue in `sales-scope.ts`, which is allowlisted). In practice, `managerId` is a UUID from the JWT so the returned IDs are the manager's own tenant team. Indirect leak possible if cross-tenant managers share a managerId, which is impossible in practice (UUIDs are unique per-row). **Safe.** | No |
| 5 | `broker-portal-team.service.ts:96` | `findFirst` | `email: dto.email` OR `phone: dto.phone` — user input from request body | No | Email and phone are `@unique` at the DB level. A cross-tenant check is necessary to prevent creating a duplicate that would fail with a unique-constraint error. The found user's `.role` is included in the ConflictException message. This is intentional and is the same pattern as `auth.service.ts` (which is allowlisted). The role disclosure in the error message is the same level of exposure as "email already in use" on any registration form. **Safe.** | No |
| 6 | `broker-portal-team.service.ts:179` | `findUnique` | `email: dto.email` — user input | No | Only `{ id: true }` selected. Used solely for `clash.id !== link.userId` comparison. No user data returned to caller. Same global-uniqueness check as #5. **Safe.** | No |
| 7 | `broker-portal-team.service.ts:190` | `findUnique` | `phone: dto.phone` — user input | No | Only `{ id: true }` selected. Same pattern as #6. **Safe.** | No |
| 8 | `broker-users.service.ts:54` | `findFirst` | `email: dto.email` OR `phone: dto.phone` — user input | No | No `select` clause — retrieves the full user row. The `.role` and `.email`/`.phone` are used in the ConflictException message. Same global-uniqueness intent as #5 but leaks more fields in the error. Intentional design (prevents silent role conversion). The disclosure is limited to role name in an error string. **Marginally safe; `select: { id, role, email, phone }` would be tighter.** | No |
| 9 | `broker-users.service.ts:131` | `findUnique` | `email: dto.email` — user input | No | Only `{ id: true }` selected. Comparison only. **Safe.** | No |
| 10 | `broker-users.service.ts:142` | `findUnique` | `phone: dto.phone` — user input | No | Only `{ id: true }` selected. Comparison only. **Safe.** | No |
| 11 | `deposits.service.ts:936` | `findMany` | `role: { in: [ADMIN, SALES_MANAGER] }, active: true` | No | Role-only filter; no external ID. Private `notifyStaff` method, not reachable via controller params. Same fan-out issue as #3 (missing companyId), not an IDOR. | No |
| 12 | `me-home.module.ts:171` | `findUnique` | `id: userId` — `userId` is `user.sub` from JWT (controller: `this.svc.getSummary(user.sub)`) | No | The ID comes from the authenticated user's own JWT claim. There is no path for a caller to substitute a different UUID here. **Safe.** | No |
| 13 | `notifications.module.ts:298` | `findMany` | `role: { in: [...roles] }, active: true` — roles from internal service call | No | `sendToRoles` is not called from a controller that accepts external role input. Callers pass hardcoded `UserRole` enum values. No external ID. Cross-tenant fan-out issue (missing companyId), not an IDOR. | No |
| 14 | `notifications.module.ts:572` | `findMany` | `id: { in: ids }` — `ids` comes from `resolveRecipients(dto.target, dto.targetUserId, ...)` | No | **❌ SUPPRESSION REASON IS WRONG.** When `dto.target = BroadcastTarget.USER`, `resolveRecipients` returns `[dto.targetUserId]` — a UUID from the request body. The comment says "bulk IDs supplied by this service, not from external input" — that is false for the USER target case. The query resolves `{ id, locale }` for a caller-supplied UUID with no companyId check. The information returned is only `locale` (minor), but the UUID crosses tenant boundaries without scoping. | No |
| 15 | `notifications.module.ts:768` | `findMany` | `active: true` | No | ALL_ACTIVE broadcast to all active users platform-wide. No external ID. Admin-only. Cross-tenant fanout bug (wrong, should have companyId) but not a targeted IDOR. | No |
| 16 | `notifications.module.ts:778` | `findMany` | `role: { in: roles }, active: true` | No | Role-only filter from internal call. Same as #13. **Safe as an IDOR concern.** | No |
| 17 | `reports.service.ts:342` | `count` | `role: UserRole.CUSTOMER` | No | Aggregate count; no row data returned. No external ID. Cross-tenant count (should have companyId for accuracy) but zero information disclosure risk. | No |
| 18 | `reports.service.ts:343` | `count` | `role: { in: [ADMIN, SALES, SM] }` | No | Same as #17. **Safe.** | No |
| 19 | `requests.module.ts:156` | `findUnique` | `phone` — from `findOrCreateClient(fullName, phone, email)` — phone is user-supplied on a public form | No | `findOrCreateClient` is a dedup upsert: find the CLIENT by globally-unique phone, or create them. Phone uniqueness is global by design (a visitor submitting two forms with the same phone should produce one record). The same phone cannot be registered twice regardless of tenant. **Safe as IDOR.** | No |
| 20 | `requests.module.ts:159` | `findUnique` | `email` — user-supplied on public form | No | Same global-uniqueness rationale as #19. **Safe.** | No |
| 21 | `requests.module.ts:162` | `create` | N/A | **Yes** — `companyId: getTenantContext()?.companyId ?? null` | Not a read; creates user with tenant context correctly set. **Safe.** | No |
| 22 | `requests.module.ts:258` | `findUnique` | `id: userId` — `userId` is the authenticated user's `user.sub` from JWT | No | Caller's own ID. No substitution path. **Safe.** | No |
| 23 | `reservations.module.ts:953` | `findUnique` | `id: userId` — authenticated user's `user.sub` | No | `buildUserOwnershipFilter(userId)` is called with `userId` from `user.sub` (JWT). No external substitution. **Safe.** | No |
| 24 | `reservations.module.ts:970` | `findMany` | `phone: { contains: suffix }` — suffix derived from the authenticated user's own phone (read in #23) | No | Phone suffix comes from the authenticated user's own record, not from request input. The query finds identity peers by phone for ownership scoping. Bounded by `@unique` semantics. **Safe.** | No |
| 25 | `reservations.module.ts:979` | `findUnique` | `email: emailKey` — derived from the authenticated user's own email (read in #23) | No | Same derivation path as #24. **Safe.** | No |

---

## 4. Calls that are NOT safe

Two suppressions are incorrect. The reason comments for both were wrong at commit time.

### ❌ Row 2 — `bonus.module.ts:465`

```typescript
// in BonusService.salesPerformance(opts)
if (opts.role === UserRole.ADMIN) {
  repIds = opts.salesId ? [opts.salesId] : await salesActorIds(this.prisma);
}
// ...
const inReps = { in: repIds };
// eslint-disable-next-line no-restricted-syntax          ← WRONG
this.prisma.user.findMany({ where: { id: inReps }, select: { id: true, fullName: true } })
```

**Attack path:** `GET /v1/bonus/sales-targets/performance?salesId=<any-uuid>` by an ADMIN.  
`opts.salesId = query.salesId` flows directly into `repIds = [opts.salesId]` with no
`scope.includes()` guard (that guard exists only for `SALES_MANAGER`). The subsequent
`findMany` resolves `{ id, fullName }` for the supplied UUID with no `companyId` filter.
An ADMIN can enumerate user names from other tenants by UUID.

**This is V-01 (cross-tenant IDOR).** The suppression should not have been applied.

### ❌ Row 14 — `notifications.module.ts:572`

```typescript
// in buildPushResults(ids, notifIdByUser)
// eslint-disable-next-line no-restricted-syntax -- bulk IDs supplied by this service, not from external input
const usersWithLocale = await this.prisma.user.findMany({
  where: { id: { in: ids } },
  select: { id: true, locale: true },
});
```

The comment is factually wrong. When `dto.target = BroadcastTarget.USER`,
`resolveRecipients` returns `[dto.targetUserId]` — a UUID from the request body.
`buildPushResults` is then called with those caller-supplied IDs. The query reads
`locale` for a UUID that may belong to another tenant's user.

The direct information disclosure is `locale` only (ar/en), which is minor. The more
significant issue is that the service then calls `this.push.sendToUser(targetUserId, ...)`
— an ADMIN can push a notification to any user by UUID, including users in other tenants.

**This is a cross-tenant data action (push notification to another tenant's user).** The
suppression reason is wrong and the call needs a `companyId` ownership check before pushing.

---

## 5. Suppression method

Every suppression in `404f567` is **line-level** (`eslint-disable-next-line`), not
file-level (`eslint-disable`). A line-level disable silences exactly one violation on
the following line and does not hide future violations added to the same file. The
suppression method is correct in form.

However, eleven of the twenty-five suppressions have **no reason comment** — the bare
`// eslint-disable-next-line no-restricted-syntax` form. The four in
`notifications.module.ts` and four in `requests.module.ts`/`reservations.module.ts`
do include reason text. The suppressions in `audit`, `bonus`, `broker-portal`,
`broker-users`, `deposits`, `me-home`, and `reports` were added without a reason,
making future reviewers unable to quickly judge legitimacy.

---

## Summary

| Category | Count | Verdict |
|---|---|---|
| Genuinely safe: role/JWT/phone/email filter, no external ID in where | 21 | OK to suppress (but add companyId where missing as separate fix) |
| Wrong reason comment, real IDOR risk | 2 | **Must be reverted or fixed before Step B** |
| Missing companyId but not a targeted IDOR (role/count queries) | 7 (subset of above 21) | Acceptable short-term suppression; tracked as MT-012 tech debt |
| No reason comment (form issue only) | 11 | Should add reason text |
