# Broker Module — End-to-End QA Checklist

> **How to use:** Run each scenario manually against a freshly-seeded local
> environment. Tick the box when the case passes. A failed case must block
> deploy until either fixed or explicitly waived.

## 0. Prerequisites

- [ ] API booted on port 4000; web-admin on the configured port
- [ ] Seed has at least one ADMIN user, one SALES user, two brokers with users
- [ ] `npx prisma migrate status` reports up-to-date (Phase 1/8/9 migrations applied)
- [ ] Smoke script run: `tsx apps/api/scripts/smoke-broker-module.ts` exits 0

---

## 1. Admin onboards a broker

- [ ] As ADMIN, create a new Broker via `/dashboard/brokers/new` (companyName, code, commissionModel, defaultCommissionPct)
- [ ] List page shows the new broker with status PENDING
- [ ] Edit page allows setting bank/tax/contract fields
- [ ] Status can be transitioned PENDING → ACTIVE
- [ ] Duplicate `code` is rejected at the API layer (409)

## 2. Broker user login

- [ ] As ADMIN, add a broker user via `/dashboard/brokers/:id/users/new` with a unique email
- [ ] First user is auto-set as primary contact
- [ ] Adding a second user with `isPrimaryContact=true` demotes the previous primary
- [ ] Cannot mark a SUSPENDED broker user as primary
- [ ] Broker user can log in and lands on `/portal`, NOT `/dashboard`
- [ ] ADMIN attempting to open `/portal/*` is redirected to `/dashboard`

## 3. Broker access to projects / units

- [ ] ADMIN grants BrokerProjectAccess for two projects
- [ ] ADMIN grants BrokerUnitAccess for a single unit on a third project
- [ ] Broker sees only those three projects in `/portal/projects`
- [ ] Broker sees only units belonging to granted projects + the single granted unit in `/portal/units`
- [ ] Revoking project access soft-flags the row (`active=false`); broker stops seeing it but row remains
- [ ] Re-granting the same access updates the existing row (idempotent — no duplicate rows)

## 4. Broker lead submission

- [ ] Broker submits a lead from `/portal/leads/new` with required fields (fullName, phone)
- [ ] Lead is persisted with `brokerId`, `brokerAgentId` from scope (NOT from body)
- [ ] Lead shows up in `/dashboard/broker-leads` with brokerApprovalStatus = PENDING
- [ ] Admin sees broker name + agent name on the row
- [ ] Lead activity feed shows `LEAD_SUBMITTED`

## 5. Duplicate lead flow

- [ ] Broker re-submits a lead with the same phone — server returns the lead with `isDuplicate=true`
- [ ] Lead row in admin is created with brokerApprovalStatus = DUPLICATE
- [ ] Portal form keeps user on the page with a notice, no redirect
- [ ] Original (non-duplicate) lead is unaffected

## 6. Admin lead approval / rejection / mark-duplicate

- [ ] ADMIN approves a PENDING lead → status APPROVED, IN_APP notification fired to the broker user
- [ ] ADMIN rejects a PENDING lead → status REJECTED with a reason field stored
- [ ] ADMIN marks a lead duplicate → status DUPLICATE with a `duplicateOfLeadId` set
- [ ] SALES role can read these broker leads (intentional) but cannot perform approve/reject/mark-duplicate
- [ ] BROKER role gets 403 attempting any of these actions

## 7. Broker visit request

- [ ] Broker submits a visit request from `/portal/visits/new` linked to a lead
- [ ] Activity feed shows `VISIT_REQUESTED`
- [ ] Admin sees the visit in admin visits queue; broker name/agent are visible
- [ ] Visit cannot be created for a lead in another broker firm

## 8. Broker reservation creation

- [ ] Broker creates reservation from `/portal/reservations/new` referencing a granted unit + a lead with `assignedSalesId`
- [ ] Reservation persists with `salesId` from `lead.assignedSalesId` (NOT NULL), `brokerId`/`brokerAgentId` from scope
- [ ] Commission snapshot fields (`commissionLockedPct`, `commissionLockedAmount`) recorded on reservation at create
- [ ] Lead without `assignedSalesId` → reservation blocked with a clear error
- [ ] Unit not in broker's access → 403
- [ ] Duplicate active reservation on the same unit blocked

## 9. Admin reservation approval

- [ ] ADMIN approves the reservation → status APPROVED
- [ ] Broker sees status update in `/portal/reservations`
- [ ] Activity log gains `RESERVATION_CREATED` for the broker

## 10. Reservation → Contract conversion

- [ ] ADMIN converts an APPROVED reservation to a Contract
- [ ] Contract inherits `brokerId`, `brokerAgentId` from the reservation only — request body cannot override
- [ ] Contract appears under `/dashboard/broker-contracts` and `/portal/contracts`
- [ ] Activity log shows `CONTRACT_CREATED` (broker timeline)

## 11. Contract signing

- [ ] ADMIN sets `signedAt` on the broker contract
- [ ] `BrokerCommission` materializes ONCE (re-signing or repeated calls do not duplicate)
- [ ] Notification `broker_contract_signed` fired to broker primary contact
- [ ] Re-converting / re-signing the same contract returns `already_exists` from materialize and creates no duplicate row
- [ ] Unsigned contracts (no `signedAt`) do NOT produce a commission

## 12. Commission materialization

- [ ] Commission `grossAmount` = `basisAmount * commissionLockedPct / 100` or matches snapshot if locked-amount used
- [ ] `taxAmount`, `withholdingAmount`, `netAmount` recomputed server-side; UI cannot inject them
- [ ] Commission gets the broker's earned date, broker firm, agent, projectId from the unit lineage
- [ ] Decimal precision preserved (no float drift in repeated reads)

## 13. Commission approval / rejection / cancel

- [ ] ADMIN approves a PENDING commission → APPROVED, eligible for payouts
- [ ] ADMIN rejects → REJECTED with reason; not selectable for payout
- [ ] ADMIN cancels a commission **not linked to any payout** → CANCELLED
- [ ] Cancel attempt on commission linked to a DRAFT/APPROVED/PROCESSING/PAID payout → blocked with explicit error
- [ ] Cancelled payout's commissions become cancellable again

## 14. Payout draft creation

- [ ] ADMIN drafts a payout, period optional, paymentReference optional
- [ ] Drafting picks only eligible commissions (broker match, status=APPROVED, payoutId=null) via `/broker-payouts/eligible-commissions`
- [ ] Multi-broker selection is REJECTED (single broker per payout)
- [ ] Adding a commission of another broker firm → 400
- [ ] Removing a commission from DRAFT updates totals

## 15. Payout lifecycle

- [ ] DRAFT → APPROVED: blocked when no commissions linked, blocked when any linked commission is not APPROVED
- [ ] APPROVED → PROCESSING: only from APPROVED
- [ ] PROCESSING → PAID: requires PROCESSING; sets `paidAt`; commissions' `paidAt` mirror payout
- [ ] DRAFT/APPROVED → CANCELLED: unlinks all commissions (payoutId=null), zeroes totals in same transaction
- [ ] PROCESSING → CANCELLED: blocked
- [ ] PAID → anything: blocked (PAID is terminal)

## 16. Broker reports / performance

- [ ] `/dashboard/broker-reports` shows summary KPIs, top brokers, projects, funnel
- [ ] `/dashboard/brokers/:id/performance` shows per-broker funnel + monthly trend + project/agent breakdowns + recent lists
- [ ] `/portal/performance` shows broker-scoped numbers; the agent breakdown is hidden for non-managers
- [ ] Date range filter excludes data outside the window; zero denominators show — not NaN/Infinity
- [ ] Non-existent broker UUID returns 404 (not 500)

## 17. CSV exports

- [ ] `/dashboard/broker-reports` → "تصدير الملخص" downloads `broker-summary-YYYY-MM-DD.csv`
- [ ] `/dashboard/broker-reports` → "تصدير أعلى الوسطاء" downloads top-brokers CSV
- [ ] `/dashboard/brokers/:id/performance` → "تصدير CSV" downloads multi-section detail CSV
- [ ] `/portal/performance` → broker-scoped export
- [ ] Files open in Excel with proper Arabic characters (UTF-8 BOM)
- [ ] Cells containing `,` or `"` are RFC-4180 quoted
- [ ] BROKER cannot hit `/v1/broker-reports/export/*` directly (403)
- [ ] `/api/csv?path=...` only accepts whitelisted paths; bogus paths return 404

## 18. Notification inbox

- [ ] `/dashboard/notifications` shows the inbox for the ADMIN
- [ ] `/dashboard/notifications/templates` continues to manage templates
- [ ] `/portal/notifications` shows the inbox for the broker user
- [ ] Topbar bell shows correct unread count
- [ ] Clicking the bell goes to the inbox for that surface
- [ ] Marking one as read clears the dot and reduces the count
- [ ] "Mark all read" clears the badge entirely
- [ ] Notifications carrying `leadId`/`reservationId`/`contractId`/`commissionId`/`payoutId` link to the right entity page on the right surface

## 19. Activity timeline

- [ ] `/portal/activity` merges LeadActivity + BrokerActivityLog ordered by createdAt desc
- [ ] All 17 portal activity types render with the right label and icon
- [ ] Filter by entityType limits the rows correctly
- [ ] Activity items link to the correct entity page (lead/reservation/contract/commission/payout)
- [ ] Broker cannot see another firm's activity

## 20. Cross-role access denial

- [ ] BROKER hitting `/v1/brokers` → 403
- [ ] BROKER hitting `/v1/broker-commissions/:id/approve` → 403
- [ ] BROKER hitting `/v1/broker-payouts` → 403
- [ ] BROKER hitting `/v1/broker-reports/summary` → 403
- [ ] SALES hitting `/v1/broker-payouts` → 403
- [ ] SALES hitting `/v1/broker-reports/summary` → 403
- [ ] ADMIN hitting any `/portal/*` → 403 (BrokerScopeGuard rejects non-broker token)

## 21. Inactive broker firm / user blocking

- [ ] Setting broker firm status to INACTIVE/SUSPENDED locks the broker out of `/portal/*` (BrokerScopeGuard throws)
- [ ] Setting broker user status to SUSPENDED locks the user out even if firm is ACTIVE
- [ ] Re-activating the firm/user restores access without data loss

## 22. Edge cases

- [ ] Lead without `assignedSalesId` → reservation create rejected with a clear Arabic message
- [ ] Reserving an inaccessible unit → 403
- [ ] Duplicate reservation attempt on a unit that already has a non-CANCELLED reservation → blocked
- [ ] Signing a contract whose reservation has a zero commission snapshot → commission is materialized with zero amounts (no crash); appears in lists with `0` totals
- [ ] Adding a commission that already belongs to another payout → rejected (`assertCommissionsEligible`)
- [ ] PAID payout cancel attempt → 409 (explicit, not 500)
- [ ] CSV export with zero rows → returns a CSV that contains the header but no body, file still downloads
- [ ] Notifications list when user has zero notifications → empty state renders, no error
- [ ] Activity feed with zero events → empty state renders

---

## Sign-off

- [ ] All sections 1–22 passing
- [ ] No 500 errors in API logs during run
- [ ] No console errors in browser during the admin and portal walkthroughs
- [ ] CSV downloads verified in Excel + Numbers + LibreOffice
- [ ] Manual QA performed by: ______________________ Date: __________
- [ ] Production deploy approved by: _________________ Date: __________
