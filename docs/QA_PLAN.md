# Full-platform QA plan — "people working with their own hands"

Goal: before any company uses the platform, every role does its real work end
to end on an empty system, every surface (admin web, public site, customer app,
staff app, broker portal) is exercised, and what we find is fixed and re-tested.
Exit = the criteria in section 8 are met, not "the tests we wrote pass".

## 1. Principles
1. **Start from nothing.** Wipe the local database, apply migrations, seed only
   what a real onboarding has (platform super admin). Everything else is created
   the way a person would: through the UI (and the public/customer flows), not by
   scripts. Scripts/SQL are used only to *check* (the database is the witness).
2. **One story, many hands.** Test cross-role chains (a lead becomes a reserved
   unit, a contract, paid installments, a maintenance request), because most
   defects live at the hand-over between roles.
3. **Positive, negative, permission.** Each feature: works with good input, fails
   clearly with bad input, and is refused for the roles that must not use it.
4. **Two companies.** Tenant isolation is tested with a second company; nothing
   of company A may ever appear to company B.
5. **Every finding is logged, fixed in its own small PR, and re-run.** Log:
   `docs/qa/findings.md` (id, role, surface, steps, expected, actual, severity,
   status, PR).

## 2. Roles and surfaces
| Role | Where it works | Notes |
|---|---|---|
| Guest (no account) | public website, customer app (browse) | catalog, inquiries, visit requests, sign-up |
| Customer / Client | customer app, public site | finance, contracts, installments, proofs, maintenance, chat, favourites, notifications |
| Broker | broker portal (web), staff app | leads, reservations, contracts, commissions, payouts |
| Sales | admin web (sales view), staff app | leads, visits, reservations, contracts, own targets/compensation |
| Sales manager | admin web, staff app | team dashboard, team targets, approvals |
| Maintenance supervisor | staff app, admin web | requests queue, assignment, status, closing |
| Admin | admin web, staff app | everything in one company: users, permissions, settings, finance, reports |
| Super admin | admin web (platform) | companies, domains, plans, AI, platform health |

## 3. Phase 0 — clean start (day 1)
- Wipe the local database; run `prisma migrate deploy`; `pnpm db:schema-check` = 0.
- Seed only: platform super admin. Create company A (and later B) through the
  super-admin UI; first admin through the real invite/activation path.
- Bring up API, admin web, public web, customer app (web build), staff app (web
  build), storage (MinIO) and Redis. Record versions/commit in the findings log.
- Smoke: every app loads, login page of each surface works.

## 4. Phase 1 — set-up as a company admin (company A)
Branding, domain, languages, currency, time zone; settings and their effects;
roles and permissions (create every role's user, check each permission toggle
takes effect immediately); projects → phases → buildings → units (all unit
types/statuses, bulk import, media, prices, payment plans); installment plan
templates; customer fields and form layouts; print settings; document types;
notification preferences; broker activation and terms.

## 5. Phase 2 — each role's own work (by role)
For each role: log in/out, wrong password, lock-out, OTP flow where used, session
expiry, password reset, profile, notification preferences, every screen reachable
from its navigation, every button on each screen, every empty/loading/error state,
Arabic + English (RTL/LTR), light + dark, phone and desktop widths.
- **Guest:** browse projects/units, filters, compare, favourites prompt to sign in,
  inquiry, visit request, sign-up, forgot password, SEO pages (site), CMS pages.
- **Customer:** my property, contracts, installment schedule, pay + upload proof,
  proof rejected → re-upload, statement, receipts, maintenance request with photos,
  chat/assistant, notifications, documents, e-sign, profile, delete/leave flows.
- **Broker:** register, activation, leads (own only), reservation, contract,
  commission preview/approval/payout, reports, cannot see other brokers' data.
- **Sales:** lead intake, follow-ups, visits (create/reschedule/complete/no-show),
  reservation (cash/instalment), contract creation and manual contract, deposits,
  targets and compensation, calendar, can see own data only.
- **Sales manager:** team view, reassign leads, approve reservations/discounts,
  team targets, team performance.
- **Maintenance supervisor:** queue, assign, status changes, cost/notes/photos,
  customer notified, closing, history.
- **Admin:** every admin page and export (CSV/XLSX/PDF), users, permissions,
  audit logs, reports (sales, financial incl. comparison), ledger, refunds,
  cancellations, transfers, price changes, bounced cheques, data import/export.
- **Super admin:** create/suspend/restore company, domains, plans/pricing, AI
  settings, cross-company isolation, impersonation limits (if any).

## 6. Phase 3 — cross-role chains (the short stories; the master cycle is 6a)
1. Guest → inquiry → lead (auto-assigned) → sales follow-up → visit → reservation
   (+ booking payment proof) → admin approves → contract → signing → installments →
   customer pays/uploads → admin confirms → statement and reports agree.
2. Broker brings a customer → commission rules → approval → payout → clawback on
   cancellation.
3. Contract cancellation / transfer / price change / unit swap → refunds, ledger,
   commissions, bonuses all consistent.
4. Late payments: overdue sweep, late fee, notifications, aging in reports.
5. Maintenance: customer files → supervisor assigns → works → closes → customer
   rates; notifications on every step.
6. Targets & bonuses across a month; sales manager vs sales vs admin views match.
7. Two companies in parallel; same phone/email in both; domain routing.

## 6a. Phase 3a — the master cycle (one continuous loop, every role)
One story, one customer, one unit, one set of money, passed from role to role.
Run it twice: once for a customer who comes from the website, once for one who
comes through a broker. Each step is checked three ways: the result in front of
the person who acted, the effect for the next person (notification, screen,
number), and the database.
1. Super admin creates the company, connects its domain, switches the plan on.
2. Admin sets the identity, project, units, payment plan; creates a sales
   manager, a salesperson, a maintenance supervisor, and activates a broker.
3. Guest browses the company's website, compares units, sends an inquiry and a
   visit request.
4. The system makes the lead and assigns it; the salesperson is notified.
5. Sales manager sees it in the team view; reassigns it once.
6. Salesperson follows up, books a visit, completes it.
7. Salesperson creates the reservation with a booking payment; the unit closes
   to everyone else.
8. Sales manager and admin approve the reservation (and a discount).
9. Contract is created, shown to the customer, signed electronically.
10. The instalment schedule, the commission and the bonus are generated.
11. The guest becomes a customer: signs in to the company's customer app, sees
    the unit, the contract and the instalments.
12. Customer pays an instalment and uploads the proof.
13. Admin rejects one proof and approves another; the customer sees both and
    re-uploads.
14. Reports agree across admin, manager, salesperson and customer app and with
    the database.
15. Time moves (explicit date change): an instalment goes late, the fee and
    notifications fire, aging shows it, the customer pays it.
16. Customer opens a maintenance request with a photo.
17. Maintenance supervisor takes it, assigns, changes status, closes with a cost.
18. Customer is notified at each step and rates it.
19. Broker path: broker brings a customer, reservation, contract, commission,
    admin approval, payout.
20. Cancellation: refunds, clawback of commission and bonus, unit released; each
    role sees the right numbers.
21. Final reconciliation by SQL: paid, due, refunds, commissions, bonuses equal
    every report.
A failed step stops the cycle: log it, fix it in its own PR, restart from that
step. Screenshots at every hand-over.

## 6b. Phase 3b — every likely scenario (variant matrix)
The master cycle is the main road; these are the side roads, each run at least
once and checked the same three ways.
- **Where the lead comes from:** website inquiry, visit request, customer app,
  walk-in by sales, broker, import, duplicate phone/email, existing customer.
- **Lead life:** every status transition, lost, reopened, reassigned, merged.
- **Visits:** create, reschedule, cancel, no-show, complete, conflicting slots,
  past dates, visit by broker's customer.
- **Reservation:** cash and instalment, with and without a booking payment,
  booking proof rejected, expiry, cancellation, conversion to a contract, two
  people on one unit, a unit already reserved or sold, a broker's reservation.
- **Payment plans:** cash, down payment + monthly, with a final (balloon)
  payment, unequal rows, grace, month-end dates, a plan changed after signing.
- **Contract:** signed, unsigned, manual contract, e-sign refused/expired,
  cancellation with commission kept and with commission clawed back, transfer
  (تنازل) with its fee, price change, unit swap, handover date moved.
- **Money:** cash, bank transfer, cheque (cleared, bounced, replaced,
  cancelled), proof approved/rejected/re-uploaded, payment ahead of date, partial
  payment, overpayment, late payment with fee, waived fee, refund, reversal.
- **Sales pay:** targets, compensation, bonus rules, clawbacks, a month rolling
  over, a manager's team vs a person.
- **Broker pay:** commission rules, adjustments, approval, payout batch, failed
  payout, clawback.
- **People:** invite, activation, suspension, deletion, role change while
  signed in, permission changed while signed in, password reset, 2FA on/off,
  session list and revoke.
- **Customers:** guest, sign-up, a person who is lead + client + customer,
  customer with two units, with two companies' apps.
- **Maintenance:** categories and SLA, urgent, photos, reassigned, reopened,
  cost and tax, closed without cost, customer cancels.
- **Content & marketing:** CMS pages, campaigns, notifications to a segment,
  templates, opt-outs.
- **Admin back office:** import/export, data migration, print documents, audit
  log, refunds queue, cancellations, settings that change behaviour (each one).

## 6c. Company identity (each company has its own website and its own app)
- Website: one codebase, the company is found from the domain (or the dev
  header). Two companies with different brands must each show only their own
  name, logo, colours, contact numbers, pages, SEO tags and share previews.
  An unknown or disconnected domain is handled cleanly.
- Customer app: one build per company (`COMPANY_SLUG`). Its name, logo, colours,
  contact card and pages are the company's; nothing of another company or of the
  platform brand shows; a switched-off company shows the "app not available"
  screen.
- Documents, notifications and emails carry the right company's identity.
- A person who belongs to company A cannot sign in to company B's app or site
  with A's account, and the error says so plainly.
- Real Android/iOS per-company builds need the release decisions (REL1:
  applicationId, bundle id, keystore, Firebase files). Until then identity and
  behaviour are tested on the web builds.

## 7. Phase 4 — breadth checks across everything
- **Permissions:** for every endpoint/page, the allowed role works and every other
  role gets a clean refusal (UI hides it, API returns 403, nothing leaks).
- **Tenant isolation:** company B cannot read or change company A by id guessing,
  search, export, notifications, files, or cached pages.
- **Data integrity (SQL witness):** money adds up (contract value, due, collected,
  overdue, refunds), no orphan rows, status machines never skip, soft-deleted rows
  never counted, report totals equal the sum of their rows.
- **Time:** time zones, month ends, leap/DST, due-today edge cases.
- **Input:** Arabic/English names, long text, emoji, numbers with separators,
  duplicate phone/email, huge files, wrong file types, double submit, back button.
- **Concurrency:** two people reserve the same unit; two admins approve the same
  proof; parallel payments on one installment.
- **Files & documents:** upload, download, private access, expiry of links.
- **Notifications:** in-app, push (with a real or stub provider), email/SMS stubs;
  every trigger fires once and reaches only the right person.
- **UI quality:** layout at 360/768/1440, RTL mirroring, dark mode, focus order,
  keyboard use, contrast, empty states, loading and error states, no raw keys or
  English leftovers in Arabic.
- **Performance:** lists with thousands of rows (seed volume test), slow queries,
  page weight, API p95 under a modest load.
- **Security:** auth brute-force limits, JWT/refresh handling, IDOR, XSS in text
  fields, CSRF on cookie sessions, file-type and size limits, secrets not exposed,
  rate limits, audit log completeness.
- **Operations:** backup/restore script, migrations on a populated copy, health
  endpoints, logs, scheduled jobs (sweeps, reminders) run once and are idempotent.

## 8. Exit criteria ("ready for companies")
- Zero open Blocker/Critical; zero open High that touches money, permissions or
  tenant isolation; every Medium either fixed or accepted in writing.
- Every scenario in sections 4–7 (including 6a, 6b, 6c) executed at least once by role, with result noted; the master cycle passes twice from an empty database;
  the money-integrity SQL checks pass on the final data set.
- Automated regression added for each fixed Blocker/Critical/High (API e2e or
  Playwright), CI green.
- Two full clean runs from an empty database without a new Blocker/Critical.
- Real-device checklist (`docs/staff-app-device-test.md`) done on an Android and an
  iPhone for the two apps (cannot be done in the cloud sandbox).

## 9. How it is run
- Web (admin, public, broker portal): Playwright driving a real browser, acting as
  the role, with screenshots on failure and on every key step.
- Mobile apps: the Flutter web builds driven by Playwright (same screens and logic,
  not the OS shell); push, camera, biometrics, store behaviour are left to the
  real-device checklist.
- Checks: SQL queries and API calls are used to read back state, not to create it.
- Cadence: one role/area per working block → report (what passed, what failed, what
  was fixed) → next. Severity: Blocker (cannot work / data loss / money wrong /
  leak), Critical (core flow broken), High (feature broken, workaround exists),
  Medium (wrong but harmless), Low (polish).

## 10. Order of work
Phase 0 → Phase 1 → admin & super admin (Phase 2) → sales/manager/broker →
customer/guest → maintenance → master cycle (3a, twice) → variant matrix (3b) →
company identity (3c) → breadth (Phase 4) → second clean run from an empty
database (the master cycle again, end to end).
