# Broker Module — Production Readiness Report

_Last reviewed: 2026-05-18 (Phase 11)_

## 1. Summary of completed broker features

| Phase | Feature |
| --- | --- |
| 1 | Broker schema foundation (Broker, BrokerUser, BrokerProjectAccess, BrokerUnitAccess + nullable broker fields on Lead/Reservation/Contract/VisitRequest) |
| 1.5 | Idempotent seed + safe cleanup script for legacy demo duplicates |
| 2 | Admin broker management API (brokers, broker-users, broker-access) |
| 3 | Admin broker management UI under `/dashboard/brokers/*` |
| 4 | Broker portal read-only foundation (`/portal/me`, `/portal/projects`, `/portal/units`, `/portal/profile`) + `BrokerScopeGuard` |
| 5 | Broker leads + visits (portal submit, admin review with approve/reject/mark-duplicate) |
| 5.1 | Broker activity timeline + IN_APP notifications |
| 6 | Broker reservations (portal create with commission snapshot, admin queue) |
| 7 | Broker contract attribution (auto-copied from reservation on convert + signed-event triggers) |
| 8 | BrokerCommission model + materialization on contract sign + admin/portal UI + backfill script |
| 9 | BrokerPayout + BrokerActivityLog + commission cancel guard + admin/portal UI |
| 10 | Performance + reports engine (computed-on-demand, no schema changes) + monthly trend chart |
| 10.1 | CSV export (UTF-8 BOM), notification inbox, funnel viz, dashboard polish |
| 11 | Hardening: audits, QA checklist, smoke script, readiness doc |

## 2. Route / permission matrix

### Broker portal (`/v1/portal/*`)

| Method | Path | Roles | Guard | brokerId source |
| --- | --- | --- | --- | --- |
| GET | /portal/me | BROKER | BrokerScopeGuard | scope |
| GET | /portal/profile | BROKER | BrokerScopeGuard | scope |
| GET | /portal/projects | BROKER | BrokerScopeGuard | scope |
| GET | /portal/units | BROKER | BrokerScopeGuard | scope |
| GET/POST | /portal/leads | BROKER | BrokerScopeGuard | scope |
| GET | /portal/leads/:id | BROKER | BrokerScopeGuard | scope |
| GET/POST | /portal/visits, /portal/visits/requests | BROKER | BrokerScopeGuard | scope |
| GET | /portal/activity | BROKER | BrokerScopeGuard | scope |
| GET/POST | /portal/reservations | BROKER | BrokerScopeGuard | scope |
| GET | /portal/reservations/:id | BROKER | BrokerScopeGuard | scope |
| GET | /portal/contracts(/:id) | BROKER | BrokerScopeGuard | scope |
| GET | /portal/commissions(/:id) | BROKER | BrokerScopeGuard | scope |
| GET | /portal/payouts(/:id) | BROKER | BrokerScopeGuard | scope |
| GET | /portal/performance, /portal/performance/agents | BROKER | BrokerScopeGuard | scope |
| GET | /portal/performance/export.csv | BROKER | BrokerScopeGuard | scope |

### Admin & sales

| Method | Path | Roles |
| --- | --- | --- |
| ALL | /brokers, /brokers/:id, /brokers/:id/status, /brokers/:id/users | ADMIN |
| ALL | /broker-users/* | ADMIN |
| ALL | /brokers/:id/access/* | ADMIN |
| GET | /broker-leads, /broker-leads/:id | ADMIN, SALES |
| PATCH | /broker-leads/:id/{approve, reject, mark-duplicate} | ADMIN |
| GET | /broker-reservations(/:id) | ADMIN, SALES |
| GET | /broker-contracts(/:id) | ADMIN, SALES |
| GET | /broker-commissions(/:id) | ADMIN, SALES |
| PATCH | /broker-commissions/:id/{approve, reject, cancel} | ADMIN |
| ALL | /broker-payouts/* | ADMIN |
| GET | /broker-reports/* + /broker-reports/export/* | ADMIN |
| GET/POST | /notification-templates, /notifications/send | ADMIN |
| GET/PATCH | /me/notifications, /me/notifications/:id/read, /me/notifications/read-all | any authenticated user |

`JwtAuthGuard` + `RolesGuard` are registered globally via `APP_GUARD` in `app.module.ts`, so no route is reachable without an authenticated bearer token.

## 3. Data integrity rules

- `Broker.code` is unique.
- `BrokerUser.userId` is unique — one User row → at most one broker firm.
- Primary-contact uniqueness per broker is enforced by the create/update path in `broker-users.service.ts` (the previous primary is demoted in the same transaction before the new one is promoted).
- `BrokerProjectAccess(brokerId, projectId)` and `BrokerUnitAccess(brokerId, unitId)` are composite-unique → grants are idempotent.
- Access revocation is a soft `active=false` flag; no hard delete preserves history.
- `Lead.brokerId` / `Reservation.brokerId` / `Contract.brokerId` are populated only by trusted code paths:
  - Portal lead create → `scope.brokerId`
  - Portal reservation create → `scope.brokerId`; `salesId` from `lead.assignedSalesId` (never nullable)
  - Reservation → Contract conversion → copied from `Reservation` only; request body is ignored.
- `BrokerCommission.contractId` is unique → at most one commission per contract, materialized once at sign-time.
- Materialization uses the **locked** snapshot fields on the reservation (`commissionLockedPct`, `commissionLockedAmount`), not the live broker default — so subsequent commission-rate edits do not retroactively affect signed deals.
- `BrokerPayout.totalGross` / `totalNet` are recomputed server-side from linked commissions on every membership change inside the same transaction. UI-supplied totals are ignored.
- `PAID` payout is terminal: no service path transitions out of `PAID`.
- Commission cancel is blocked when the commission is linked to a non-`CANCELLED` payout.
- No hard-delete endpoint exists for any broker entity (broker, broker user, commission, payout, contract).

## 4. Financial safety rules

1. All money fields use `Prisma.Decimal`; arithmetic uses `Decimal.add/mul/div`. No floating-point math is persisted.
2. Totals are recomputed from the DB on every state transition (`recomputeTotals` is called inside the same transaction that adds/removes commissions).
3. `payout.approve` requires at least one linked commission, all in `APPROVED` status.
4. `payout.markPaid` requires current status = `PROCESSING`.
5. Adding / removing commissions is allowed only when payout = `DRAFT`.
6. Commission cancel is blocked if the linked payout is not `CANCELLED`.
7. `payout.cancel` from `DRAFT`/`APPROVED` unlinks all commissions (`payoutId=null`) in the same transaction.
8. `payout.cancel` is blocked from `PROCESSING` and `PAID`.
9. `BrokerPayout` has no `DELETE` controller; the only way to retire a payout is `CANCELLED`.

## 5. Known limitations

- The `recompute → store` model means a manual SQL update to commission rows will not propagate to payout totals until the next add/remove cycle. Mitigation: smoke script flags payout/commission total drift.
- Payout cancel currently zeroes `totalTax` / `totalWithholding` along with `totalGross` / `totalNet`. This is fine for an unpaid payout (those amounts go away with the linked commissions) but means audit historic deductions live only on the commission rows, not the payout.
- Notifications are IN_APP only — there is no SMS/EMAIL/PUSH dispatcher yet. Templates with `channel=PUSH/EMAIL` will write the row but not deliver.
- Activity feed merge happens in memory (`page * pageSize` from each source) — fine up to a few hundred thousand rows per broker, will need a unified feed table beyond that.
- Top-brokers report does N×8 aggregates in parallel — fine to about 1k brokers per call.

## 6. Deferred improvements

- **Indexes** (advisory only, no migration this phase):
  - `BrokerCommission(brokerId, earnedAt, status)` — composite for top-brokers.
  - `Lead(brokerId, brokerApprovalStatus, createdAt)`.
  - `Contract(brokerId, signedAt, totalAmount)` for salesGross aggregations.
  - `Reservation(brokerId, status, createdAt)`.
  - `BrokerActivityLog(brokerId, type, createdAt)`.
  - `Notification(userId, readAt, createdAt)` — collapses the existing two single-column indexes.
- **Performance materialisation:** a `BrokerPerformanceMonthly` table is **not** justified yet at expected scale (≤10k brokers, ≤1M leads). Reconsider only when summary endpoints exceed 500ms p95.
- **Top-brokers SQL rewrite:** switch from per-broker fan-out to a single raw groupBy when broker count grows past ~1k.
- **Notification dispatcher:** wiring PUSH/EMAIL/SMS channels into a background worker.
- **CSV export pagination:** current exports stream the full result in one response; large detail exports may want streaming when brokers accumulate years of data.

## 7. Deployment checklist

- [ ] Confirm the three broker-related migrations are present and applied in target environment:
  - `20251xxx_broker_schema_foundation` (Phase 1)
  - `20251xxx_broker_commission` (Phase 8)
  - `20251xxx_broker_payout_activity_log` (Phase 9)
  - Run `npx prisma migrate status` and compare with `apps/api/prisma/migrations` directory listing.
- [ ] `npx prisma migrate deploy` (NOT `migrate dev`) against production database.
- [ ] `npx prisma generate` post-deploy so the API process picks up the matching client.
- [ ] Run seed against staging: confirms idempotency. **Do NOT** run seed against production unless documented for that environment.
- [ ] Run `tsx apps/api/scripts/smoke-broker-module.ts` against the deployed DB. Exit 0 required to proceed.
- [ ] Confirm cookies/CORS configured for the API origin used by the web admin.
- [ ] Confirm `API_BASE_URL` env on the web-admin deployment.
- [ ] Bring up one canary admin user, log in, hit `/dashboard/broker-reports` — verify summary loads without 500.
- [ ] Bring up one canary broker user, log in to `/portal` — verify projects/units list loads.

## 8. Migration checklist (recap)

| Migration | Applied? | Notes |
| --- | --- | --- |
| Phase 1 — broker_schema_foundation | yes (dev/staging) | Additive; nullable broker fields on existing tables. |
| Phase 8 — broker_commission | yes (dev/staging) | Adds `BrokerCommission`, `BrokerCommissionStatus`. |
| Phase 9 — broker_payout_activity_log | yes (dev/staging) | Adds `BrokerPayout`, `BrokerActivityLog`, enums, `payoutId` on `BrokerCommission`. |
| Phase 10 / 10.1 / 11 | n/a | No schema changes. |

## 9. Rollback considerations

- All broker fields on existing tables (`Lead`, `Reservation`, `Contract`, `VisitRequest`, `VisitAppointment`) are nullable — rolling back the application code leaves the data intact and ignored by the older code.
- Rolling back Phase 8 (commission) without Phase 9 cleanup: the `BrokerCommission` table has FK constraints on `Contract`/`BrokerUser`/`Broker`; dropping it after a partial rollback requires `CASCADE` or unlinking via `payoutId=NULL` first.
- Rolling back Phase 9 (payout) safely: cancel all open payouts via the UI first so commissions are detached, then `prisma migrate resolve --rolled-back <phase-9-name>` and revert the API. **Never `prisma migrate reset` against production.**
- The CSV export route handler (`/api/csv`) in web-admin uses a whitelist; rolling back a CSV endpoint that the whitelist still references will surface a 502 — update the whitelist together with the API.
- Topbar bell makes one extra HTTP call per request to `/me/notifications?unreadOnly=1`. If the API is unreachable the bell hides the badge (try/catch returns 0); rolling back has no UI impact.

## 10. Manual QA sign-off checklist

See [broker-module-qa-checklist.md](./broker-module-qa-checklist.md) (22 scenarios, ~80 line items).

Sign-off should include:

- Reviewer name, date, env (staging/canary).
- Pass/fail per scenario.
- Any waivers must be explicitly approved by engineering + product before deploy.

## 11. Out-of-scope housekeeping noted during audit

- `apps/api/scripts/dedupe-generic-leads.ts` (CRM-side, not broker) defaults to **execute** rather than dry-run. Consistency with the other scripts would be `const DRY_RUN = !process.argv.includes('--execute')`. Left untouched in Phase 11 (out of broker scope) but flagged here so the next CRM hardening pass picks it up.
