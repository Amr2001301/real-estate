# Phase 16 — System Settings + Permissions UI

_Generated 2026-05-18._

## 1. Existing settings findings

[apps/api/prisma/schema.prisma:1367](../prisma/schema.prisma#L1367):

```prisma
model Setting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}
```

- The schema has **only three columns**: `key`, `value (JSON)`, `updatedAt`.
- No `type`, `group`, `description`, or `sensitive` column.
- The previous service [settings.module.ts](../src/modules/settings/settings.module.ts) exposed:
  - `GET /settings` (list)
  - `GET /settings/:key` (get)
  - `PUT /settings/:key` with body `{value: object | array}` (no primitives accepted)
- ADMIN-only via `@Roles`.
- No filtering, no grouping, no sensitive-value handling.

The current local DB has **zero** Setting rows seeded.

## 2. Existing permissions findings

[apps/api/prisma/schema.prisma:122](../prisma/schema.prisma#L122):

```prisma
model Permission {
  id          String           @id @default(uuid()) @db.Uuid
  code        String           @unique
  description String?
  users       UserPermission[]
}

model UserPermission {
  userId       String     @db.Uuid
  permissionId String     @db.Uuid
  user         User       @relation(...)
  permission   Permission @relation(...)
  @@id([userId, permissionId])
}
```

Seeded codes — [apps/api/prisma/seed.ts:342-354](../prisma/seed.ts#L342-L354):

```
brokers:read           brokers:create       brokers:update
brokers:suspend        brokers:terminate    broker_users:read
broker_users:invite    broker_users:update  broker_users:remove
broker_leads:approve   broker_leads:reject
```

- **No service / module existed** for Permission or UserPermission management.
- **No guard reads `UserPermission`.** A repo-wide search for `PermissionsGuard` / `UserPermission` returns zero hits. Permission rows are stored but never consulted at request time.
- Role-based access control via `@Roles(UserRole.X)` + `RolesGuard` is still the only enforcement layer.

## 3. Backend endpoints created (or extended)

### Settings

| Method | Path | Roles | Purpose | Notes |
| --- | --- | --- | --- | --- |
| GET | /settings | ADMIN | Paginated-less list with filters `group` (derived from key prefix) and `q` (substring on key) | Returns `key, value, updatedAt, group, sensitive` |
| GET | /settings/:key | ADMIN | Single setting, sensitive values masked | |
| PUT | /settings/:key | ADMIN | Legacy upsert; body `{value: object | array}` | Kept for compatibility with prior scripts |
| PATCH | /settings/:key | ADMIN (**new**) | Accepts any JSON shape (string/number/bool/array/object) | Refuses to write the literal `***REDACTED***` placeholder back |

`group` is computed at read time from the key prefix: `company.name` → `company`, `broker.defaultCommissionPct` → `broker`, keys without a dot → `system`.

### Permissions (new module)

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | /permissions | ADMIN | All permissions with `userCount` per code |
| GET | /users/:id/permissions | ADMIN | User summary + assigned + available |
| PATCH | /users/:id/permissions | ADMIN | `{addPermissionCodes[], removePermissionCodes[]}`; resolves codes up front (fails atomically on unknown code); uses `createMany skipDuplicates` for adds and `deleteMany` for removes; returns the refreshed full view |

The new module is registered in [apps/api/src/app.module.ts](../src/app.module.ts#L37-L88).

## 4. Frontend pages created (or rewritten)

| Path | Purpose | Notes |
| --- | --- | --- |
| `/dashboard/settings` | **Rewritten.** Grouped settings tables (group prefix → Arabic label), search + group filter, masked values for sensitive keys (`*token*`, `*secret*`, `*apiKey*`, `*password*`, `*webhook*`), per-row edit form, "add new setting" card | Replaces the bare 80-line page with a richer layout. Old `PUT` endpoint remains intact for any other client. |
| `/dashboard/permissions` | List of all permission codes with `userCount` badge, search by code/description, side card with quick-link to manage a user's permissions | |
| `/dashboard/users/[id]/permissions` | User card + assigned list (each with revoke button + confirm dialog) + available list (select + add button) | Uses [`ConfirmingForm`](../../web-admin/src/components/confirming-form.tsx) for revokes (Phase 14 helper) |
| In-page info banner | `الصلاحيات التفصيلية محفوظة في النظام، وقد لا تكون مفعّلة على كل المسارات بعد...` | Shown on both permissions pages |

## 5. Sensitive masking behaviour

| Aspect | Behaviour |
| --- | --- |
| Mask scope | Settings only (audit-log masking lives in Phase 15) |
| Detection | Case-insensitive substring on the **key** name — `password`, `token`, `apikey`, `apisecret`, `secret`, `webhook`, `privatekey` |
| Mask value | `***REDACTED***` returned in the JSON response |
| Storage | Plaintext value remains in the DB (unchanged); only the wire response is masked |
| Round-trip protection | `PATCH /settings/:key` rejects a body whose `value` is the literal `***REDACTED***` string with a NotFound error, so the masked placeholder cannot accidentally overwrite the real value if an admin saves the form without typing a new value |
| UI hint | Sensitive rows show a lock icon and a small notice: "يجب إعادة إدخالها بالكامل لتحديثها" |

## 6. Permission enforcement status

**Permissions are assignable but not enforced.** As of this phase:

- No `PermissionsGuard` exists.
- No route in the codebase reads `UserPermission` before serving a response.
- `RolesGuard` (driven by `User.role` + `@Roles`) is the only enforcement layer.

The user-facing UI surfaces a banner stating this on both permission pages. The phase-16 report (this file) is the canonical reference for the gap.

## 7. Safety decisions

1. **No schema migration.** `Setting` and `Permission` schemas are kept exactly as they are. Group/sensitive/type are derived at read time.
2. **`PUT /settings/:key` preserved.** The old object/array DTO contract remains intact for any other consumer (scripts, dev tools). The new `PATCH` is the canonical endpoint for the new UI.
3. **`PATCH /users/:id/permissions` does NOT touch `User.role`.** It only adds/removes `UserPermission` join rows. Role changes still go through whatever user-management flow already exists; this endpoint cannot accidentally elevate a user to ADMIN.
4. **Unknown permission codes fail atomically.** The service resolves every code up front; if any is unknown the entire operation aborts before any DB write. No partial application.
5. **`createMany skipDuplicates`** for grants means re-adding an already-assigned permission is a no-op — the composite PK `(userId, permissionId)` makes the operation idempotent at the DB level too.
6. **Confirmation on revoke.** The user-permissions page wraps the revoke button in `ConfirmingForm` (from Phase 14) — accidental clicks won't drop a permission. Grant has no confirm because it's reversible.
7. **No delete endpoint** for permissions themselves. Codes are seeded server-side; the UI cannot create/rename/delete `Permission` rows.
8. **Sensitive masking is best-effort.** If a key doesn't contain one of the seven fragments, its value is shown plainly. New fragments centralize in [settings.module.ts](../src/modules/settings/settings.module.ts) `SENSITIVE_KEY_FRAGMENTS`.

## 8. Audit log integration

Confirmed: the global `AuditInterceptor` ([audit.interceptor.ts](../src/common/interceptors/audit.interceptor.ts)) already wraps every mutating HTTP method. So:

- `PUT /settings/:key` and `PATCH /settings/:key` writes produce an `AuditLog` row with `actorId`, `action=PUT|PATCH`, `entityType=v1/settings`, `entityId=<the key>`, response `after` (sensitive masking from the interceptor's own helper kicks in on the `after` payload too — see Phase 15).
- `PATCH /users/:id/permissions` produces a row with `entityType=v1/users` and the user-id in `entityId` and the refreshed view in `after`.

The detail page in `/dashboard/audit-logs/[id]` can navigate from a settings/permissions audit row back to the relevant entity via its hardcoded `RELATED_LINK_MAP` (settings show as plain text since they don't have a dedicated viewer per-key, which is fine).

## 9. Manual test steps

| # | Steps | Expected |
| --- | --- | --- |
| 1 | As ADMIN, open `/dashboard/settings` | Page renders; if no settings exist, empty-state card; if settings exist, grouped tables sorted by group |
| 2 | Type `company.name` + `My Company` in the "add new setting" card → Save | Success banner; row appears under "الشركة" group |
| 3 | Edit the value to `{"ar": "شركتي", "en": "My Co"}` and Save | JSON parsed; row's preview shows the formatted object |
| 4 | Add a setting with key `stripe.apiKey` and a fake value | Row appears; preview reads `***محجوب***`; UI hint reminds you to re-enter the full value to update |
| 5 | Hit `PATCH /v1/settings/stripe.apiKey` with body `{"value": "***REDACTED***"}` | API responds 404 (refused) |
| 6 | Open `/dashboard/audit-logs` | Both saves appear with `action=PATCH` and `entityType=v1/settings` |
| 7 | Open `/dashboard/permissions` | All seeded codes shown with user-count badges (likely all `0 مستخدم` on a fresh DB) |
| 8 | Search "broker_leads" | Filtered to `broker_leads:approve` and `broker_leads:reject` |
| 9 | Click "إدارة" on the side card for any user → page opens at `/dashboard/users/<id>/permissions` | Assigned + available split correctly |
| 10 | Pick a code from the "إضافة صلاحية" dropdown → click "إضافة" | Success banner; code moves from available to assigned |
| 11 | Click "سحب" on an assigned code | Browser confirm dialog appears with the user's name and the code; cancel keeps the row; confirm removes it |
| 12 | Add the same code twice (call API directly) | Second call is a no-op due to `skipDuplicates` |
| 13 | PATCH `/v1/users/:id/permissions` with `{addPermissionCodes: ["nonsense:thing"]}` | 400 with `Unknown permission code(s): nonsense:thing` |
| 14 | Inspect User.role on the user before and after permission changes | Unchanged — this endpoint never touches `role` |
| 15 | As SALES (token), `GET /v1/settings` | **403** |
| 16 | As BROKER (token), `GET /v1/permissions` | **403** |
| 17 | As SALES (token), `PATCH /v1/users/:id/permissions` | **403** |

## 10. Deferred improvements

1. **Full `PermissionsGuard` rollout.** Add a `@Permissions('brokers:approve')` decorator + a guard that reads `UserPermission` for the current actor and enforces the code. Roll out gradually — start with `broker_leads:approve` and `brokers:terminate` (high blast radius). Keep `@Roles` as the coarse gate; let permission checks layer on top.
2. **Role templates.** Predefined bundles ("Junior Sales", "Senior Sales", "Compliance Reviewer") that an admin can apply with one click instead of granting codes individually. Pure UI feature once §1 lands.
3. **Settings wired into business logic.** Today the Settings table is a key/value store with no consumers. Wire-up candidates flagged in audits:
   - `reservation.expiryHours` for reservation timeouts
   - `lead.duplicateWindowDays` for the dedupe heuristic
   - `broker.defaultCommissionPct` for new-broker onboarding default
   - `notifications.channels.enabled` for the multi-channel dispatcher when it ships
4. **Settings change history.** Today only the latest `updatedAt` is stored. A `SettingHistory(key, value, changedBy, changedAt)` table would let admins see a diff over time. The audit log captures this indirectly via the `after` payload — sufficient for now.
5. **Secret-manager integration.** For real secrets (Stripe live keys, webhook signing secrets), move storage out of `Setting.value` into AWS Secrets Manager / Vault and keep only a reference in the DB. The mask-on-read shipped in this phase is a stopgap, not a vault.
6. **Schema upgrade.** Add `type`, `group`, `description`, `sensitive` columns to `Setting`. Migrate the on-read derivation into the row itself. Worth doing alongside §3 so consumers have proper typing.

## 11. Commands run

```bash
cd apps/api      && npx prisma validate          # ✅ valid
cd apps/api      && npx tsc --noEmit             # ✅ 0 errors
cd apps/web-admin && npx tsc --noEmit            # ✅ 0 errors
cd apps/api      && npx tsx scripts/smoke-broker-module.ts   # ✅ 16 pass / 1 warn / 0 fail
```

## 12. Final readiness verdict

### **READY**

- Settings and permissions are now manageable from the admin UI without exposing secrets in cleartext.
- Permission writes never alter `User.role`.
- All writes go through the existing global audit interceptor.
- No schema migrations were needed.
- The "permissions assigned but not enforced" gap is explicitly surfaced in the UI banner and §6 of this report — not hidden behind a façade of working access control.

The deferred items in §10 are *enablement* improvements (real RBAC enforcement, role templates, secret manager). None of them block production use of the new admin UI; they're prerequisites for *acting* on what the UI now lets admins configure.
