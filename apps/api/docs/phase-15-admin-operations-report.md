# Phase 15 — Admin Operations Center + Audit Log Viewer

_Generated 2026-05-18._

## 1. Audit system as inspected

Existing model in [apps/api/prisma/schema.prisma](../prisma/schema.prisma#L1083) — kept as-is in this phase:

```prisma
model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  actorId    String?  @db.Uuid
  actor      User?    @relation(fields: [actorId], references: [id])
  action     String                // "POST" | "PATCH" | "PUT" | "DELETE"
  entityType String                // URL path-prefix, e.g. "v1/broker-payouts"
  entityId   String?               // captured from response body or :id param
  before     Json?                 // currently NEVER written (see §4)
  after      Json?                 // response body after sensitive-field masking
  ip         String?               // captured from req.ip
  createdAt  DateTime @default(now())
  @@index([entityType, entityId])
  @@index([actorId, createdAt])
}
```

Existing global interceptor at [apps/api/src/common/interceptors/audit.interceptor.ts](../src/common/interceptors/audit.interceptor.ts):
- Runs on every mutating method (`POST`, `PATCH`, `PUT`, `DELETE`)
- Skips `/auth/otp` and `/auth/login`
- Writes only on success (in the `tap.next` branch)
- Stores `actorId = req.user.sub` if a JWT was present
- Stores the response body (after sensitive masking — see §5)
- Captures `req.ip`

Existing module at [apps/api/src/modules/audit/audit.module.ts](../src/modules/audit/audit.module.ts):
- A single `GET /audit-logs` list with three filters (actorId, entityType, entityId), ADMIN-only.
- No detail endpoint.
- No operations summary.

## 2. API endpoints created

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | /audit-logs | ADMIN | List with filters: `actorId`, `action`, `entityType`, `entityId`, `from`, `to`, `q` (free-text against action/entityType/entityId/ip), `page`, `pageSize`. Includes the actor's `id/fullName/email/phone/role`. |
| GET | /audit-logs/:id | ADMIN | Full row + actor. 404 when not found. |
| GET | /operations/summary | ADMIN | Roll-up: totals (today / 7d / 30d), top 5 actors (7d), top 5 entity types (7d), top 10 actions (7d), per-broker-entity counts (brokers / broker-users / broker-leads / broker-reservations / broker-contracts / broker-commissions / broker-payouts / reservations / contracts). |

All three endpoints are `@Roles(UserRole.ADMIN)` at the controller class level. JWT + RolesGuard are registered globally via `APP_GUARD` in `app.module.ts`, so any non-ADMIN token receives 403.

## 3. Frontend pages created

| Path | Purpose |
| --- | --- |
| `/dashboard/operations` | KPI strip (today/week + top actor + top entity) + recent audit list + quick links + action/entity breakdown cards |
| `/dashboard/audit-logs` | Paginated list with full filter bar (q / action / entityType / actorId / date range), preserves filters in URL |
| `/dashboard/audit-logs/[id]` | Actor card + request metadata card + scrollable JSON viewers for before/after + safe "open related entity" link when the entityType maps to a known admin route |
| `/dashboard/audit` | Now a permanent redirect to `/dashboard/audit-logs` (kept so legacy bookmarks resolve) |

The list page uses the shared `<Pagination>` component, the shared `<EmptyState>`, and the standard PageHeader/Card primitives. The JSON viewer is a plain `<pre>` inside an `overflow-auto` Card with a height cap (~32rem for `after`, 24rem for `before`) so a large payload doesn't blow the layout.

## 4. Audit limitations (documented, not fixed)

| # | Limitation | Why we didn't fix it |
| --- | --- | --- |
| 1 | **`before` snapshot is never captured.** The interceptor sees only the request and the response — it doesn't read the row before the mutation runs. Detail page renders "غير متوفر" so the UI is honest about it. | Fixing it requires either Prisma middleware or a per-handler decorator; both are bigger refactors than this phase. |
| 2 | **Failed requests are never logged.** `tap.next` fires only on success; failures bypass the interceptor entirely. | Adding `tap.error` would record every validation/permission failure, which is loud. Belongs in a dedicated security-monitoring phase. |
| 3 | **No `userAgent` column.** Spec mentioned this but the model doesn't have it. | Adding the column requires a migration — explicitly out of scope for this phase. |
| 4 | **`entityType` is a URL path-prefix.** It's derived from the URL (`v1/broker-payouts`, `v1/portal/leads`) rather than the Prisma model name. Reads as a string for now. | Changing it requires per-handler metadata and breaks all historical rows. The detail page maps known prefixes to admin routes via `RELATED_LINK_MAP`. |
| 5 | **`entityId` defaults to `req.params.id`.** For create endpoints where the new row's id is on the response body, the interceptor picks it from there. Routes that return wrapped responses (e.g. `{ data: { id } }`) may miss the id. | Each affected route can opt in to a custom extractor in a future phase. |
| 6 | **No retention policy.** AuditLog rows are kept forever. | Setting a retention window needs ops sign-off; not a Phase 15 concern. |

## 5. Sensitive-data masking

**Status: ADDED in this phase.**

- New helper [apps/api/src/common/utils/sensitive-fields.ts](../src/common/utils/sensitive-fields.ts) — case-insensitive substring match on a fragment list (`password`, `passwordhash`, `token`, `refreshtoken`, `accesstoken`, `idtoken`, `authorization`, `cookie`, `set-cookie`, `secret`, `otp`, `pin`, `apikey`, `apisecret`).
- Replacement value is `***REDACTED***`.
- Walks recursively up to depth 8; never mutates input.
- Wired into the interceptor at `safeJson()` so masking runs BEFORE the value is JSON-roundtripped and persisted.
- The original `req.body` is never written — only the response body — so request-side secrets (login passwords, OTP codes posted to `/auth/otp` which is also skipped via URL) are not at risk via this code path. Masking the response body covers the case where a service accidentally echoes a token back to the client.

**Caveat:** masking is best-effort. Adding a new "secret-ish" field on a payload requires the field name to contain one of the fragments above — or the helper's list to be extended. Add new fragments centrally in [sensitive-fields.ts](../src/common/utils/sensitive-fields.ts).

## 6. Security decisions

- All three endpoints (`/audit-logs`, `/audit-logs/:id`, `/operations/summary`) are `@Roles(UserRole.ADMIN)`. SALES and BROKER receive 403 from the global `RolesGuard`.
- **No write endpoints exist** on the AuditLog: no POST, no PATCH, no DELETE. The model is append-only from the controller surface.
- The detail page renders related-entity links using a hardcoded `RELATED_LINK_MAP` — entity types not on the map are shown as plain text. This prevents constructing arbitrary links from user-controlled `entityType` values (e.g. the auditor cannot follow a malicious string to a custom admin route).
- Legacy `/dashboard/audit` is preserved as a permanent redirect — no broken bookmarks but only one canonical surface.

## 7. Files changed

| File | Change |
| --- | --- |
| 🆕 [apps/api/src/common/utils/sensitive-fields.ts](../src/common/utils/sensitive-fields.ts) | Sensitive-field masker (case-insensitive substring match) |
| ✏️ [apps/api/src/common/interceptors/audit.interceptor.ts](../src/common/interceptors/audit.interceptor.ts) | Run masking before persisting `after` |
| ✏️ [apps/api/src/modules/audit/audit.module.ts](../src/modules/audit/audit.module.ts) | Add filters, detail endpoint, operations summary |
| 🆕 [apps/web-admin/src/app/dashboard/operations/page.tsx](../../web-admin/src/app/dashboard/operations/page.tsx) | Operations Center |
| 🆕 [apps/web-admin/src/app/dashboard/audit-logs/page.tsx](../../web-admin/src/app/dashboard/audit-logs/page.tsx) | Audit log list + filter bar |
| 🆕 [apps/web-admin/src/app/dashboard/audit-logs/[id]/page.tsx](../../web-admin/src/app/dashboard/audit-logs/[id]/page.tsx) | Audit detail with JSON viewer |
| ✏️ [apps/web-admin/src/app/dashboard/audit/page.tsx](../../web-admin/src/app/dashboard/audit/page.tsx) | Now redirects to `/dashboard/audit-logs` |
| ✏️ [apps/web-admin/src/lib/types.ts](../../web-admin/src/lib/types.ts) | `AuditLogItem`, `OperationsSummary` |
| ✏️ [apps/web-admin/src/lib/nav.ts](../../web-admin/src/lib/nav.ts) | "مركز العمليات" + "سجلات التدقيق" added under "الإدارة"; legacy "سجل التدقيق" removed |
| 🆕 apps/api/docs/phase-15-admin-operations-report.md | This document |

No schema changes. No migrations.

## 8. Manual test steps

| # | Steps | Expected |
| --- | --- | --- |
| 1 | As ADMIN, open `/dashboard/operations` | KPI strip, recent activity list, quick links all render. No 500s. |
| 2 | As ADMIN, open `/dashboard/audit-logs` | List paginated 25/page, default sort newest first |
| 3 | Apply filter `action=PATCH` + `from=<yesterday>` | Only PATCH rows since yesterday |
| 4 | Click "عرض" on any row | Detail page renders actor + metadata + JSON viewers |
| 5 | If `entityType` ends with `broker-payouts`, the related-entity link button appears | Clicking it opens `/dashboard/broker-payouts/<entityId>` |
| 6 | As SALES (token), hit `GET /v1/audit-logs` directly | 403 from `RolesGuard` |
| 7 | As BROKER (token), hit `GET /v1/operations/summary` directly | 403 |
| 8 | As ADMIN, perform any mutating broker action (e.g. approve a commission) | New row appears at `/dashboard/audit-logs` within seconds; `actor` shows the admin |
| 9 | Inspect the `after` JSON for a write that handles a secret-bearing payload (e.g. `POST /auth/...` if it were audited, or any future endpoint with a `password` field in the response) | Value appears as `***REDACTED***`, not the secret itself |
| 10 | Open `/dashboard/audit` (legacy URL) | Redirected to `/dashboard/audit-logs` |

## 9. Deferred improvements

1. **`before` snapshot capture** — either via Prisma middleware that records the row before each `update`/`delete`, or via per-handler decorators that opt in. Worth doing once the financial flows need point-in-time diffing.
2. **Failed-request logging** — add `tap.error` to the interceptor, write a row with `action="FAILED"` and the error class/status. Needs noise-filtering (validation errors are loud).
3. **CSV export of audit logs** — analogous to the broker-reports CSV endpoints (`/audit-logs/export.csv` returning a UTF-8 BOM CSV with the columns the list page shows). Skipped here to keep Phase 15 narrow.
4. **Alerting for suspicious actions** — surface a banner on the Operations Center when the day's count exceeds N standard deviations from the rolling baseline, or when a single actor produces too many DELETEs in a short window. Belongs in a security-monitoring phase.
5. **Migration to add `userAgent`** + a dedicated `entityName` (the Prisma model name, not the URL prefix) + an `outcome` field (SUCCESS/FAIL). Bundle these into the same migration when you next touch the audit schema.

## 10. Commands run

```bash
cd apps/api      && npx prisma validate                # ✅ valid
cd apps/api      && npx prisma generate                # ✅
cd apps/api      && npx tsc --noEmit                   # ✅ 0 errors
cd apps/web-admin && npx tsc --noEmit                  # ✅ 0 errors
cd apps/api      && npx tsx scripts/smoke-broker-module.ts   # ✅ 16 pass / 1 warn / 0 fail
```

## 11. Final operations readiness verdict

### **READY**

- Audit module is ADMIN-only with no mutating endpoints.
- Sensitive-field masking is in place for the `after` payload (the only field the current interceptor writes).
- Three new pages, all type-check clean.
- Legacy `/dashboard/audit` route preserved as a redirect.
- Known limitations are documented (no `before`, no failed-request logging, no `userAgent`) — none of these block production use of the new viewer.

The deferred improvements in §9 are visibility/UX additions, not gaps that block launch.
