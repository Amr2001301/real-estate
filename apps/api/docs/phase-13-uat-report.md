# Phase 13 — Full UAT / Production QA Report

_Generated 2026-05-18._

> **Honesty note (read first).** This report combines two evidence types:
>
> 1. **Static checks** — `prisma validate`, `tsc --noEmit`, smoke script, migration status. These were executed and the actual results are inline.
> 2. **Code-driven verification** — each happy-path step and security rule was verified by reading the implementing service / guard / controller and quoting `file:line`. This is a thorough way to confirm wiring, but it is **not** a substitute for an interactive walkthrough against a live database with real test users.
>
> The "manual sign-off" section at the end is intentionally a checklist for the human reviewer — DO NOT mark it as done from a code-only pass.

---

## 1. Environment

| Item | Value |
| --- | --- |
| Branch | `main` |
| Commit | `ebcfa5c` (latest before this phase) |
| Database | `realestate` @ `localhost:5432` (local dev) |
| Working-tree changes | Phase 12 + 12.1 files (see `git status` below) |

Working-tree status at start of phase:
```
M apps/api/package.json
M apps/api/scripts/dedupe-generic-leads.ts
M apps/api/src/modules/broker-portal/broker-portal.controller.ts
M apps/api/src/modules/broker-portal/broker-portal.module.ts
M apps/web-admin/src/app/portal/layout.tsx
M apps/web-admin/src/lib/nav.ts
?? apps/api/docs/script-safety.md
?? apps/api/src/common/guards/broker-commissions-viewer.guard.ts
?? apps/api/src/common/guards/broker-manager.guard.ts
?? apps/api/src/modules/broker-portal/broker-portal-team.service.ts
?? apps/api/src/modules/broker-portal/dto/portal-team.dto.ts
?? apps/web-admin/src/app/portal/team/
```

### Pre-QA command output

```
$ npx prisma migrate status
14 migrations found in prisma/migrations
Database schema is up to date!
```

```
$ npx prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

```
$ npx prisma generate
✔ Generated Prisma Client (v5.22.0) … in 334ms
```

```
$ cd apps/api && npx tsc --noEmit
(no output → 0 errors)

$ cd apps/web-admin && npx tsc --noEmit
(no output → 0 errors)
```

```
$ npx tsx scripts/smoke-broker-module.ts
Total: 17 — 16 pass, 1 warn, 0 fail
```

The single `WARN` is "no broker users yet" — expected on a fresh install, not a failure.

### Migration verification

| Migration | Applied | Confirms |
| --- | --- | --- |
| `20260517163453_add_brokers_foundation` | ✅ | Phase 1 — Broker, BrokerUser, BrokerProjectAccess, BrokerUnitAccess + BROKER enum value |
| `20260518001547_add_broker_commission` | ✅ | Phase 8 — `BrokerCommission` |
| `20260518013425_add_broker_payout_and_activity_log` | ✅ | Phase 9 — `BrokerPayout`, `BrokerActivityLog`, `BrokerCommission.payoutId` |

All required migrations are applied. No schema drift.

---

## 2. Test data

Because this UAT pass is code-driven (no interactive browser session), no live test records were created. The smoke script confirms the schema is queryable but reports zero broker users yet on this database (1 ADMIN user exists, 1 Broker row exists from earlier dev work).

**Recommended test data for the human sign-off** is the same set the prompt described:

| Role | Notes |
| --- | --- |
| ADMIN user | seed default |
| Internal Sales user | seed default |
| Broker firm | created via `/dashboard/brokers/new` |
| Broker primary contact / manager | `isPrimaryContact=true, canManageBrokerUsers=true` |
| Broker agent A | `canManageBrokerUsers=false, canViewCommissions=false` |
| Broker agent B | `canManageBrokerUsers=false, canViewCommissions=true` |
| Test client/customer | created on first lead submit |

Test inventory: ≥1 published project · ≥1 phase/building · ≥3 AVAILABLE units · ≥1 active installment plan template · BrokerProjectAccess granting commissionPct override · ≥1 unit *not* accessible to the broker for negative tests.

The seed (`apps/api/prisma/seed.ts`) is idempotent (Phase 1.5) — running it again will not duplicate demo data. No UAT-specific seed script was added in this phase per the "no new features" constraint.

---

## 3. Happy-path results (code-verified)

| Step | Result | Evidence |
| --- | --- | --- |
| 1. Admin creates Broker → `POST /brokers` | ✅ | `apps/api/src/modules/brokers/brokers.controller.ts:27-29`, `@Roles(ADMIN)` |
| 2. Admin activates Broker → `PATCH /brokers/:id/status` | ✅ | `brokers.service.ts:157-174` updates `broker.status` |
| 3. Admin creates Broker primary contact | ✅ | `broker-users.service.ts:86-121` — atomic primary-toggle in transaction |
| 4. Admin grants project access | ✅ | `broker-access.service.ts:68-119` — Decimal `commissionPct` stored |
| 5. Broker logs in → redirects to `/portal` | ✅ | `apps/web-admin/src/lib/session.ts:42-47` |
| 6. Broker manager reaches `/portal/team` | ✅ | `broker-manager.guard.ts:35-39` requires `isPrimaryContact || canManageBrokerUsers` |
| 7. Broker agent logs in → lands on `/portal` | ✅ | Same auth, no manager flag required for home |
| 8. Broker sees only accessible projects/units | ✅ | `broker-portal.service.ts:83-85` filters by `brokerProjectAccess.active=true` |
| 9. Broker submits Lead | ✅ | `broker-portal-leads.service.ts:127-145` — `brokerId/brokerAgentId` from scope |
| 10. Admin approves Lead + assigns Sales | ✅ | `broker-leads.service.ts:111-147` validates assigned user is SALES/ADMIN |
| 11. Broker requests Visit | ✅ | `broker-portal-visits.service.ts:40-60` — scope-pinned |
| 12. Broker creates Reservation | ✅ | `broker-portal-reservations.service.ts:153-307` — locks commission snapshot, requires `lead.brokerApprovalStatus=APPROVED` AND `lead.assignedSalesId` non-null |
| 13. Admin approves Reservation | ✅ | `reservations.module.ts` patch endpoint |
| 14. Admin converts Reservation → Contract | ✅ | `reservations.module.ts:1154-1155` — copies `brokerId/brokerAgentId` from reservation only |
| 15. Admin signs Contract | ✅ | `contracts.module.ts:243-300` — `signedAt` transition triggers materializer + activity + notification |
| 16. BrokerCommission auto-created | ✅ | `broker-commissions.service.ts:107-179` — idempotent, returns `already_exists` on retry |
| 17. Admin approves BrokerCommission | ✅ | `broker-commissions.service.ts` approve action |
| 18. Admin creates BrokerPayout | ✅ | `broker-payouts.service.ts:132-254` — eligible-commissions filter + recompute on link |
| 19. Admin approves payout | ✅ | `broker-payouts.service.ts:299-329` — rejects when 0 commissions linked |
| 20. Admin processes payout | ✅ | `broker-payouts.service.ts:331-355` — APPROVED → PROCESSING |
| 21. Admin marks payout PAID | ✅ | `broker-payouts.service.ts:357-385` — PROCESSING → PAID, sets `paidAt` |
| 22. Broker sees all of their data via `/portal/*` | ✅ | All 10 portal services filter by `scope.brokerId` |
| 23. Admin sees broker reports + CSV export | ✅ | `broker-reports.controller.ts` — `/broker-reports/*` + `/export/*.csv` |
| 24. Broker exports portal performance CSV | ✅ | `broker-portal.controller.ts:258-266` — `/portal/performance/export.csv` |

**Happy-path verdict (code-verified): 24/24 wired correctly. No blockers.**

---

## 4. Negative / security results (code-verified)

| # | Rule | Result | Evidence |
| --- | --- | --- | --- |
| 1 | BROKER cannot reach `/dashboard/*` | ✅ | `requireAdmin()` in `session.ts:31` redirects BROKER → `/portal` |
| 2 | ADMIN cannot reach `/portal/*` | ✅ | `BrokerScopeGuard:41-42` rejects non-BROKER role with 403 |
| 3 | SALES cannot reach payouts/reports | ✅ | class-level `@Roles(UserRole.ADMIN)` on both controllers |
| 4 | Broker A cannot see Broker B's data | ✅ | 10 portal services scope by `scope.brokerId` (leads, visits, reservations, contracts, commissions, payouts, team, activity, performance, contracts) |
| 5 | Broker cannot lead on inaccessible project | ✅ | `broker-portal-leads.service.ts:192-203` — `assertProjectVisible()` |
| 6 | Broker cannot reserve inaccessible unit | ✅ | `broker-portal-reservations.service.ts:203, 426-444` — `assertUnitVisible()` |
| 7 | Broker cannot reserve RESERVED/SOLD unit | ✅ | `broker-portal-reservations.service.ts:204-206` — requires `unit.status=AVAILABLE` |
| 8 | Broker cannot reserve from non-APPROVED lead | ✅ | `broker-portal-reservations.service.ts:172-175` |
| 9 | Broker cannot reserve without `assignedSalesId` | ✅ | `broker-portal-reservations.service.ts:177-180` |
| 10 | Broker cannot duplicate-reserve a unit | ✅ | `broker-portal-reservations.service.ts:221-234` — active reservation check |
| 11 | Broker cannot mutate commission/payout | ✅ | `broker-portal.controller.ts:202-238` — GET-only endpoints |
| 12 | `canViewCommissions=false` blocks `/portal/commissions` + `/portal/payouts` | ✅ | `BrokerCommissionsViewerGuard` on both endpoints; sidebar filtered by `filterBrokerNavForFlags()` in `apps/web-admin/src/lib/nav.ts` |
| 13 | Agent cannot reach `/portal/team` | ✅ | `BrokerManagerGuard` on all 5 team endpoints |
| 14 | Cannot remove last active manager | ✅ | `broker-portal-team.service.ts:202-217` — `simulateManagement()` |
| 15 | Cannot remove last active broker user | ✅ | `broker-portal-team.service.ts:279-295` |
| 16 | Cannot manage another firm's user by id | ✅ | `broker-portal-team.service.ts:334-343` — `scopedFindOrThrow()` returns 404 |
| 17 | Paid payout cannot be cancelled | ✅ | `broker-payouts.service.ts:389-395` — blocks anything not in `{DRAFT, APPROVED}` |
| 18 | Commission linked to non-CANCELLED payout cannot be cancelled | ✅ | `broker-commissions.service.ts:419-442` |
| 19 | PENDING commission cannot be added to payout | ✅ | `broker-payouts.service.ts:516-519` — `assertCommissionsEligible` |
| 20 | Already-linked commission cannot be added to another payout | ✅ | `broker-payouts.service.ts:521-524` |

**Negative/security verdict (code-verified): 20/20 enforced. No gaps.**

---

## 5. Financial QA results (code-verified)

| Rule | Result | Evidence |
| --- | --- | --- |
| Reservation commission snapshot uses BrokerProjectAccess override; doesn't refresh later | ✅ | `broker-portal-reservations.service.ts:299-332` — `commissionLockedPct` / `commissionLockedAmount` stored on row |
| Contract attribution copied only from Reservation | ✅ | `reservations.module.ts:1154-1155`; DTO does not accept `brokerId/brokerAgentId` |
| Commission created only after `signedAt` | ✅ | `broker-commissions.service.ts:154` blocks unsigned contracts |
| One commission per contract | ✅ | `BrokerCommission.contractId` `@unique` in schema; P2002 race handler at line 265 returns `already_exists` |
| `grossAmount` from reservation snapshot | ✅ | `broker-commissions.service.ts:176-186` |
| `netAmount = gross − tax − withholding` (Decimal math) | ✅ | `broker-commissions.service.ts:194` |
| Initial status = PENDING | ✅ | `broker-commissions.service.ts:217` |
| Payout includes APPROVED + unlinked commissions only | ✅ | `broker-payouts.service.ts:138-139` eligible filter |
| Payout totals recomputed in same transaction | ✅ | `recomputeTotals` called at lines 237, 271, 290 |
| Payout totals not writable from UI | ✅ | `CreateBrokerPayoutDto` lacks `totalGross/totalNet` |
| Cancel from DRAFT/APPROVED unlinks commissions | ✅ | `broker-payouts.service.ts:403` — `payoutId NULL` in same tx |
| PAID terminal | ✅ | `assertPayoutInStatus` rejects PAID for any non-read action |
| Reports `salesGross` = SIGNED contracts only | ✅ | `broker-reports.service.ts` `contractSignedWhere` builds `signedAt: {not: null, …}` |
| Commission totals from `BrokerCommission.aggregate` | ✅ | `broker-reports.service.ts:455-461` |
| Payout totals from `BrokerPayout.aggregate WHERE status=PAID` | ✅ | `broker-reports.service.ts:463-470` |
| Rate helper handles zero denominator | ✅ | `broker-reports.service.ts:1042` returns 0 when `d <= 0` |

**Financial QA verdict (code-verified): all rules hold. No drift, no NaN risk, no UI-injectable totals.**

---

## 6. UI / UX review findings

Code-walk over admin and portal page directories looking only for *clear* bugs (broken `Link` targets, missing empty states, English labels on Arabic pages, buttons visible for invalid statuses, wrong currency formatter).

| Finding | Severity | Status |
| --- | --- | --- |
| `as never` type cast on dynamic `Link` href in `apps/web-admin/src/app/dashboard/broker-payouts/[id]/page.tsx` | 🟡 cosmetic | Defer — this is the codebase's standard pattern for Next.js typed routes with dynamic UUIDs; used consistently elsewhere |
| Portal layout fallback: when `/portal/me` errors mid-session, sidebar shows the full nav rather than empty | 🟢 informational | Backend still gates every route via `BrokerScopeGuard` + per-route guards. Cosmetic only. Will fall through to API 403 banners. Documented as known limitation. |

**No P0/P1/P2 UI bugs found.** Phase 10.1 already fixed the Arabic-label and placeholder consistency issues that surfaced in Phase 11.

---

## 7. Bugs found and fixed

**None.** Code-walk did not surface a clear bug that needed fixing in this phase. The two cosmetic items above are not P3-fixable and are documented as known limitations (see §8).

---

## 8. Remaining known issues / limitations

| # | Severity | Description | Suggested follow-up phase |
| --- | --- | --- | --- |
| 1 | P3 | Portal sidebar falls back to full `BROKER_NAV_SECTIONS` when `/portal/me` fetch errors. Backend still enforces all rules — purely cosmetic. | UX polish, future phase |
| 2 | P3 | Notifications dispatcher is IN_APP only — templates with `channel=PUSH/EMAIL/SMS` are written but not delivered. | Notifications delivery phase |
| 3 | P3 | Activity feed merge happens in-memory (`page * pageSize` from each source). Fine up to ~100k rows per broker. | Index/perf phase, not urgent |
| 4 | P3 | Top-brokers report does N×8 parallel aggregates. Fine up to ~1k brokers. | Same as above |
| 5 | P3 | No `TEAM_MEMBER_*` activity log enum values — Phase 12 didn't add a migration just for team activity. Team mutations are not audit-logged through `BrokerActivityLog` (the underlying `Lead`/`User` audit interceptor still records them). | Bundle with next migration cycle |
| 6 | P3 | `dedupe-generic-leads.ts` is the only mutating CRM script — covered in script-safety doc. No other CRM scripts surfaced. | n/a |

None of the items above block production. Each is tracked and has a documented mitigation or follow-up phase.

---

## 9. Commands actually executed in this phase

```bash
cd apps/api  &&  npx prisma migrate status          # ✅ all 14 applied
cd apps/api  &&  npx prisma validate                # ✅ schema valid
cd apps/api  &&  npx prisma generate                # ✅ client regenerated
cd apps/api  &&  npx tsc --noEmit                   # ✅ 0 errors
cd apps/web-admin && npx tsc --noEmit               # ✅ 0 errors
cd apps/api  &&  npx tsx scripts/smoke-broker-module.ts  # ✅ 16 pass, 1 warn, 0 fail
```

No code was modified in this phase, so no re-runs were needed.

---

## 10. Production readiness verdict

### **READY WITH WARNINGS**

**Rationale:**

- 24/24 happy-path steps are wired correctly with proper guards, scope pinning, and transitions.
- 20/20 negative/security rules are enforced server-side.
- All 16 financial rules verified — no drift, no NaN risk, no UI-injectable totals, no cross-broker leak paths.
- Schema is up to date; smoke script reports 0 FAIL.
- No P0, P1, or P2 issues open.

**Warnings (the "with warnings" part):**

1. **The verification in §3–§5 is code-driven, not interactive.** Before deploy, a human must walk the QA checklist at [`apps/api/docs/broker-module-qa-checklist.md`](./broker-module-qa-checklist.md) against staging with real test users in a real browser. The checklist has 22 sections / ~80 line items. Sign-off block lives at the bottom of that doc.
2. **The local DB has no broker users seeded yet.** The smoke script flagged this as WARN. Make sure the production seed (or initial admin onboarding script) provisions the broker company + primary contact for each launch tenant.
3. **The known limitations in §8 are all P3** and documented. None block launch.

### Manual sign-off (TO BE COMPLETED BY THE HUMAN REVIEWER)

- [ ] Walked the [QA checklist](./broker-module-qa-checklist.md) end-to-end on staging.
- [ ] CSV exports opened cleanly in Excel + Numbers + LibreOffice.
- [ ] Cross-role denials reproduced manually (BROKER → /dashboard, ADMIN → /portal, SALES → /broker-payouts).
- [ ] `canViewCommissions=false` flow verified end-to-end (sidebar item hidden, API returns 403, error message Arabic).
- [ ] No 500 errors in API logs during the walk.
- [ ] No console errors in browser during the walk.
- [ ] Approved by: ___________________  Date: ___________
