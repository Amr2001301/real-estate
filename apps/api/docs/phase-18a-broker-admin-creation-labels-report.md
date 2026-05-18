# Phase 18A — Broker Admin Creation + Label Clarification

_Generated 2026-05-19._

## 1. Label changes made

Sidebar labels reframed to clarify what each surface represents (records originating *from* brokers — not records the company holds *with* brokers, except commissions/payouts):

| Route | Before | After |
| --- | --- | --- |
| `/dashboard/broker-leads` | فرص الوسطاء | **فرص من الوسطاء** |
| `/dashboard/broker-reservations` | حجوزات الوسطاء | **حجوزات من الوسطاء** |
| `/dashboard/broker-contracts` | عقود الوسطاء | **عقود من الوسطاء** |
| `/dashboard/broker-commissions` | عمولات الوسطاء | **عمولات الوسطاء** _(unchanged — already correct)_ |
| `/dashboard/broker-payouts` | مدفوعات الوسطاء | **مدفوعات الوسطاء** _(unchanged)_ |

Page titles + breadcrumbs + descriptions + empty states were updated to match. Specific empty-state rewrites:

- **No broker contracts** → "ستظهر هنا عقود البيع التي تم إنشاؤها من حجوزات ناتجة عن الوسطاء."
- **No broker commissions** → "تُنشأ العمولات تلقائيًا عند توقيع عقد ناتج عن وسيط. لا يتم إنشاؤها يدويًا."
- **No broker payouts** → "أنشئ أول دفعة بعد اعتماد عمولات الوسطاء."

Descriptions updated to:

- **Broker Leads**: "فرص أرسلها الوسطاء وتحتاج إلى مراجعة الإدارة."
- **Broker Reservations**: "حجوزات عملاء نشأت من بوابة الوسيط وتحتاج إلى مراجعة داخلية."
- **Broker Contracts**: "عقود بيع العملاء الناتجة عن حجوزات أرسلها الوسطاء."
- **Broker Commissions**: "عمولات تُحتسب تلقائيًا عند توقيع عقود ناتجة عن الوسطاء، وتتطلب اعتماد الإدارة قبل الدفع."
- **Broker Payouts**: "دفعات عمولات معتمدة تصرفها الشركة للوسطاء."

Two new in-page actions:

- `/dashboard/broker-reservations` now has an **إنشاء حجز نيابة عن وسيط** primary button (top-right).
- `/dashboard/broker-contracts` now has a **تحويل حجز وسيط إلى عقد** outline button that links to `?status=APPROVED` filter — no manual contract creation, just a clear path to the existing convert flow.

## 2. Admin broker-reservation creation behavior

A new admin-only endpoint:

```
POST /v1/broker-reservations   (ADMIN only)
```

DTO `CreateAdminBrokerReservationDto`:

| Field | Required | Notes |
| --- | --- | --- |
| `brokerId` | ✅ | Owning firm. Must exist and be ACTIVE. |
| `brokerAgentId` | optional | If supplied, must belong to the same broker and be ACTIVE; we use the `BrokerUser.userId` for `Reservation.brokerAgentId`. |
| `leadId` | ✅ | Lead must belong to `brokerId`, be APPROVED, have an `assignedSalesId`. |
| `unitId` | ✅ | Must exist, be AVAILABLE, be visible to broker via active `BrokerProjectAccess` or `BrokerUnitAccess`. |
| `installmentPlanTemplateId` | optional | Same validation as portal flow. |
| `selectedDurationOptionId` | optional | Required if the plan exposes duration options. |
| `notes`, `expiresInHours` | optional | Same defaults as portal (`72h`). |

Implementation:

- `BrokerPortalReservationsService.create(scope, dto)` was **refactored into a thin wrapper** around a new shared core `createForActor({ brokerId, brokerAgentUserId, actorUserId, origin, dto })`.
- `BrokerReservationsService.createOnBehalfOfBroker(actor, dto)` validates the broker + optional agent and then delegates to `createForActor({ origin: 'ADMIN_ON_BEHALF', actorUserId: actor.sub, ... })`.
- The shared core enforces ALL the same rules: lead approved, sales assigned, unit AVAILABLE + visible, no duplicate active reservation, commission snapshot locked at the same priority (project-access override → broker default), initial status `PENDING`, unit transitioned to `RESERVED` in the same transaction.
- The `LeadActivity` payload now carries `origin: 'BROKER_PORTAL' | 'ADMIN_ON_BEHALF'` so the portal timeline and audit log can distinguish the two paths cleanly. The `ReservationActivity.note` is set accordingly: "Created via broker portal" vs "Created by admin on behalf of broker".

**Never two implementations of a hot financial path.** Portal and admin both go through `createForActor()`.

### Files

| File | Change |
| --- | --- |
| ✏️ [broker-portal-reservations.service.ts](../src/modules/broker-portal/broker-portal-reservations.service.ts) | Refactored `create` into a thin wrapper; new `createForActor()` core accepts explicit identity. |
| ✏️ [broker-reservations.service.ts](../src/modules/broker-reservations/broker-reservations.service.ts) | New `createOnBehalfOfBroker(actor, dto)`. Injects `BrokerPortalReservationsService`. |
| ✏️ [broker-reservations.controller.ts](../src/modules/broker-reservations/broker-reservations.controller.ts) | New `POST /broker-reservations` ADMIN-only route. |
| ✏️ [broker-reservations.module.ts](../src/modules/broker-reservations/broker-reservations.module.ts) | Imports `BrokerPortalModule` for the shared service. |
| ✏️ [broker-reservations/dto/broker-reservation.dto.ts](../src/modules/broker-reservations/dto/broker-reservation.dto.ts) | New `CreateAdminBrokerReservationDto`. |
| 🆕 [/dashboard/broker-reservations/new/page.tsx](../../web-admin/src/app/dashboard/broker-reservations/new/page.tsx) | Server component — preloads brokers, agents, approved leads, projects, AVAILABLE units. |
| 🆕 [/dashboard/broker-reservations/new/_form.tsx](../../web-admin/src/app/dashboard/broker-reservations/new/_form.tsx) | Client cascading form: broker → agent, broker → leads, project → units. |
| 🆕 [/dashboard/broker-reservations/new/actions.ts](../../web-admin/src/app/dashboard/broker-reservations/new/actions.ts) | Server action posting to `/broker-reservations`. |

## 3. Contract creation decision

**No direct admin "create broker contract" flow.** Contracts must come from converting an APPROVED broker Reservation — that's the only path where `Contract.brokerId` / `brokerAgentId` inherit from the source Reservation. Allowing manual entry would let an admin invent a broker attribution out of thin air.

UX nudge:

- `/dashboard/broker-contracts` header now has a clear outline button **تحويل حجز وسيط إلى عقد** that deep-links to `/dashboard/broker-reservations?status=APPROVED`.
- The conversion itself goes through the existing `ReservationsService.convertReservation` (Phase 7) which copies `brokerId`/`brokerAgentId` from the Reservation and refuses any value supplied in the request body.

## 4. Commission creation decision

**No "Add Commission" button anywhere.** Commissions are materialised automatically by `BrokerCommissionsService.materializeFromContract()` at contract-sign time (Phase 8). The empty state was rewritten to make this explicit:

> تُنشأ العمولات تلقائيًا عند توقيع عقد ناتج عن وسيط. لا يتم إنشاؤها يدويًا.

There's also already a one-time `scripts/backfill-broker-commissions.ts` (dry-run by default) for filling gaps after a deploy — that remains the safe path, not an in-UI button.

## 5. Payout creation verification

Verified by re-reading [broker-payouts.controller.ts](../src/modules/broker-payouts/broker-payouts.controller.ts):

- `POST /broker-payouts` — **ADMIN only**.
- `POST /broker-payouts/:id/add-commissions` — ADMIN only.
- `POST /broker-payouts/:id/remove-commissions` — ADMIN only.
- All status transitions (`approve`, `process`, `mark-paid`, `cancel`) — ADMIN only.
- The broker portal's payout endpoints in [broker-portal.controller.ts](../src/modules/broker-portal/broker-portal.controller.ts) are GETs only and are gated by both `BrokerScopeGuard` and `BrokerCommissionsViewerGuard`. No BROKER role can reach any payout mutation surface.

No changes needed in this phase.

## 6. Unit access UX improvement

- 🆕 [_unit-access-form.tsx](../../web-admin/src/app/dashboard/brokers/[id]/access/_unit-access-form.tsx) — client component with project-first cascade:
  1. Pick project from a dropdown.
  2. Unit dropdown is enabled and filtered to units in that project where `building.phase.projectId` matches.
  3. By default only `AVAILABLE` units are listed. A toggle "إظهار الوحدات غير المتاحة (للعرض فقط)" reveals RESERVED/SOLD units as **non-selectable** (`option disabled`); they're still shown with their status as a hint.
- ✏️ [broker-access.service.ts](../src/modules/broker-access/broker-access.service.ts) — `assertUnitGrantable()` server-side guard. Refuses to mint a unit-level access grant when the unit's status is `SOLD` or `RESERVED`. Replaces the older lax `assertUnitExists`. Reactivating an existing access on a unit that has since moved to one of those states is also refused, so the form and the API stay aligned.

The page-level description was updated to say so: "لا يمكن منح صلاحية وصول لوحدة محجوزة أو مباعة."

Revoke flows are unaffected.

## 7. Security checks

| Rule | Status | Where |
| --- | --- | --- |
| Admin can create broker reservation on behalf of broker | ✅ | `POST /broker-reservations` `@Roles(UserRole.ADMIN)` |
| Broker can create own reservation from portal | ✅ | unchanged — `POST /portal/reservations` still routes through `BrokerScopeGuard` and the now-shared `createForActor` core |
| Broker cannot create contracts | ✅ | `/broker-contracts/*` exposes GETs only; portal has no contract create endpoint |
| Broker cannot create commissions | ✅ | No POST anywhere on `/broker-commissions`; portal commissions endpoints are GET-only |
| Broker cannot create payouts | ✅ | All `/broker-payouts` mutations are `@Roles(UserRole.ADMIN)` |
| Admin payout creation remains ADMIN-only | ✅ | unchanged |
| SALES access unchanged | ✅ | broker-reservations / contracts / commissions list+detail still allow `ADMIN, SALES`; create is ADMIN-only |
| Broker portal still cannot accept `brokerId` from body | ✅ | `CreatePortalReservationDto` has no `brokerId`; the portal wrapper hard-codes it from `scope.brokerId` |
| Admin cannot pretend to be a different agent | ✅ | `brokerAgentId` must belong to the chosen `brokerId` AND be ACTIVE; otherwise 400 |
| Admin cannot grant access to a sold/reserved unit | ✅ | `assertUnitGrantable` refuses SOLD/RESERVED units at the API; UI filters by default |

## 8. Compile / type results

```bash
cd apps/api      && npx prisma validate               # ✅ valid
cd apps/api      && npx tsc --noEmit                  # ✅ 0 errors
cd apps/web-admin && npx tsc --noEmit                 # ✅ 0 errors
cd apps/api      && npx tsx scripts/smoke-broker-module.ts   # ✅ 17 pass / 0 warn / 0 fail
```

No schema changes. No migration.

## 9. Manual test steps

| # | Steps | Expected |
| --- | --- | --- |
| 1 | As ADMIN open `/dashboard/broker-reservations` | New "إنشاء حجز نيابة عن وسيط" primary button is visible top-right. |
| 2 | Click it → page opens with disabled lead/unit dropdowns until broker is picked. | |
| 3 | Pick a broker → URL updates with `?brokerId=…` → agent dropdown populates with active broker users; lead dropdown populates with that broker's APPROVED leads that have an internal sales assignment. | |
| 4 | Pick a project → URL updates → unit dropdown shows only AVAILABLE units in that project. | |
| 5 | Click "حفظ الحجز" → redirected to the new reservation's detail page. The reservation row appears in `/dashboard/broker-reservations`. | |
| 6 | Open `/portal/reservations` as the same broker → the reservation is visible there too with origin `ADMIN_ON_BEHALF` in its activity payload. | |
| 7 | The selected unit transitioned to `RESERVED`. The commission snapshot (`commissionLockedPct` / `commissionLockedAmount`) is set per project-access override or broker default. | |
| 8 | Try selecting an agent that doesn't belong to the picked broker (via dev tools) → API returns 400. | |
| 9 | Try selecting a unit not in the broker's access → API returns 403 ("Unit is not accessible to this broker"). | |
| 10 | From `/portal/reservations/new`, a broker still creates their own reservation. No regression. | |
| 11 | `/dashboard/broker-contracts` shows the **تحويل حجز وسيط إلى عقد** outline button; no direct create form exists. | |
| 12 | `/dashboard/broker-commissions` empty-state reads "تُنشأ العمولات تلقائيًا عند توقيع عقد ناتج عن وسيط. لا يتم إنشاؤها يدويًا." | |
| 13 | `/dashboard/broker-payouts/new` still exists and is the only path to create a payout — ADMIN only. | |
| 14 | `/dashboard/brokers/<id>/access?tab=units` → form shows project dropdown first; unit dropdown is disabled until a project is picked; only AVAILABLE units are listed; the "show all" toggle reveals RESERVED/SOLD units but they're non-selectable. | |
| 15 | Try POSTing `/v1/brokers/<id>/access/units` with a SOLD unit's id directly (bypassing UI) → API returns 409 from `assertUnitGrantable`. | |
| 16 | Audit log records `POST v1/broker-reservations` with `actor = the admin`. | |

## 10. Deferred improvements

1. **Commission backfill UI button**. Today it's the `scripts/backfill-broker-commissions.ts` dry-run-by-default script (Phase 8). A read-only admin preview surface (`GET /broker-commissions/missing`) plus an idempotent action that calls the same `materializeFromContract` would be a UX win but is not required.
2. **Convert-to-contract row action** inline in the broker reservations table for APPROVED rows. The header button + status filter cover the common case; the row-level action is sugar.
3. **Lead-aware project preselect**. After picking a lead, default the project dropdown to `lead.projectInterestId` when present. Today the admin re-picks the project manually.
4. **Project-aware commission preview**. After picking broker + project, show the resolved commission rate ("This broker → this project = N% / fixed X") on the reservation form so admin sees the snapshot they're about to lock.
5. **Bulk grant access for a project's units**. Currently project-access already grants access to all units in the project — the unit-access form is for *additional* per-unit grants. A "بطاقات وحدات متعددة" multi-select could be added later if the existing UX feels narrow.
6. **Portal nav copy** kept as-is ("الفرص / الزيارات / الحجوزات / العقود") because that's the broker user's own perspective; the "from brokers" framing only matters on the admin side.

## 11. Final readiness verdict

### **READY**

- Labels and empty states across the five broker-* admin pages now reflect that these records originate from brokers — not records held with brokers.
- Admin can create a broker-originated reservation on behalf of a broker; the path reuses the exact same hot core as the portal flow (no duplicated financial logic).
- Contracts and commissions stay computed from upstream events — no manual create.
- Payouts remain ADMIN-only; broker portal payout endpoints stay read-only.
- Unit access form now requires picking a project first and refuses to grant access on RESERVED/SOLD units at both the UI and API layer.
- All type checks + smoke green; no schema changes.

The deferred items in §10 are *quality-of-life* additions; none block production use of the new flows.
