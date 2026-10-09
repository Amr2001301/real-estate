# Devora — Prioritised Backlog

Originally written 2026-10-06 against `main` at `447a260`. **Status updated
2026-10-08** after PRs #1–#17. Item numbers are kept so references in PRs and
docs stay valid.

Order: data that is wrong where someone acts on it → launch blockers → dated
deadlines → unmeasured risk → features. Functional gaps (FG-xx) are tracked in
detail in `docs/audit/08-functional-gaps.md` §7.

## Done

| # | Item | Where |
|---|---|---|
| 1 | `api · jest (unit)` red | `b203b6c` |
| 2 | `/dashboard/users` did not paginate | `130718f`, e2e A4c |
| 3 | Option B — one account per company; `User` → `TENANT_OWNED` | PRs #5, #6; follow-ups #7 (cron context), #8 (notification templates per company) |
| 4–6 | FG-01, FG-02, FG-03 | Already in the code when the backlog was written — but FG-01 was only partly done: the API link is below, the UI is Open |
| 7 | FG-23 — three sales dashboards counted client-side; `/dashboard/maintenance` showed only the first 100 requests | PR #2; maintenance paged (20 per page) |
| 8 | FG-21 — phone written unnormalised | PR #3 (also FG-24, PR #4) |
| 9 | `pageSize` unbounded | `c15beaf` (max 500), e2e A4d |
| 10 | Dropdowns fetched 100–500 full rows | Create-form pickers search the API (PRs #11–#14); filters and assignee dropdowns use `/options` endpoints (PR #15) |
| 11, 12 | Ubuntu 24.04 pin, Node 24 actions | PR #1 (CI gap G14/G15) |
| FG-28 | Client ownership: reps saw no clients (GET /users ADMIN-only) and the server accepted any client or lead id | Decided 2026-10-08: rep → own, manager → team, admin → all, unowned → admin assigns. Enforced server-side; scoped `GET /users/clients` |
| FG-27 | Signed contracts read `UNSIGNED` | `sign()` sets ACTIVE; backfill migration (PR #17) |
| Server actions hang | On routes under a `loading.tsx`, a server action's result was sometimes never shown (button stuck busy, form never redirected). Root cause: a lost Suspense ping in the React 19.2 canary bundled with Next 15.5 — React held a fulfilled promise but never re-rendered. web-admin upgraded to Next 16.4 (React 19.3 canary): 0/120 hangs vs 39/160 before | PR #20 (web-admin); web-public Next 16 PR |
| One company currency everywhere (#33–#36) | The currency setting (`reports.currency`) was ADMIN-only and offered no Egyptian pound; other roles silently got SAR; the public site, JSON-LD, apps, chat and notifications hard-coded ج.م / EGP / SAR | `Company.currency` (default EGP) is the single source, picked on the branding page (9 codes incl. EGP). Every dashboard role and the broker portal read `GET /company/currency`; the site reads the public branding (60 s cache); the customer app reads the branding, the staff app `/company/currency`; notifications and chat format amounts with it. `reports.currency` migrated and refused. e2e A4p, Playwright `company-currency` (web-admin + web-public), Dart `company_currency_test` |
| Dates and amounts follow the locale (web-admin) | The format helpers always used `ar-EG`, so the English dashboard and portal showed Arabic-Indic digits and `ر.س` | `formatDate`/`formatDateTime`/`formatCurrency`/`formatCompact`, the SLA/warranty labels and `currencySymbol` take the locale (en → `en-EG`, Latin digits, currency code); every caller passes it, and direct `toLocaleString('ar-…')` calls use `intlLocale(locale)`. Print pages stay Arabic. Playwright `locale-formatting`; `portal-i18n` no longer excludes dates/amounts |
| Leaflet map in `next dev` | Under `next dev`, react-leaflet 4 threw "Map container is already initialized" (Strict Mode mounts effects twice) and the project map did not render | react-leaflet 5 (React 19) in web-public and web-admin; the map renders in dev on both |
| Broker portal i18n (#21) | The broker portal was Arabic-only, hard-coded | Every `/portal` page and the shared components it renders follow the `admin-locale` cookie (ar/en), like the dashboard; strings in `src/messages/portal/*`. Playwright `portal-i18n` opens every portal page in English and fails on Arabic UI text. Dates/amounts: see the open item |
| Deposit reverse / delete UI | The API reversed and deleted deposits safely (FG-05) but web-admin had no button for either | The deposit page has "Reverse" (with a reason; shown only while the deposit still pays its installment — `reversible` on `GET /deposits/:id`), "Delete" and, on a deleted deposit, "Restore". Playwright `deposits-manage` |
| FG-15 | Phase and Building had no `updatedAt` | Column on both, backfilled with `createdAt` |
| FG-14 | A client promoted to customer by their first contract was logged out (sessions revoked) without a word | `account_promoted_customer` notification on both paths (direct create, conversion); template in seed + migration |
| FG-10 | A failure starting warranties or creating the broker/sales commission on sign was only a log line — the data was silently missing | Failures are returned, audited (`contract.sign_followup_failed`) and shown on the contract page with a retry (`POST /contracts/:id/sign-followups`, idempotent) |
| FG-04 | Info requests could not leave OPEN; directly-created contracts had no number | `PATCH /info-requests/:id` + buttons on `/dashboard/requests`. `POST /contracts` numbers the contract (or keeps a given legacy number); a numberless contract can be numbered once from its page |
| FG-13 | Admin confirm deleted a rejected customer proof's deposit (orphaning its document); unconfirm left the booking PENDING after a rejected proof; confirm could double an approved proof | Confirm keeps proof deposits and refuses (409) an already-approved proof; unconfirm counts only proofs under review and rejects an approved one |
| FG-05 | Reversal accepted APPROVED deposits only, could run twice, and deleting a deposit left its installment PAID | Any deposit still paying its installment is reversible (incl. admin-recorded NO_PROOF); second reversal 409, atomic claim; delete reverses first. Delete/restore routes given their `deposits/` prefix |
| FG-01 | `Deposit.paymentInstrumentId` was never set, so clearing or bouncing a cheque touched no deposit | Decided 2026-10-08: cheque → unpaid until it clears; transfer → collected at once; one cheque per installment. API: PR #18. UI: payment method on the deposit form, `/dashboard/cheques` (deposit, clear, bounce, cancel) |
| 15 | Split the security suite (31 min) | Not needed: the job lacked Redis; with it the suite runs in ~1.5 min (PR #9, G16). A Redis outage no longer stalls the API either (PR #10) |

## Open — can be done in the repo

| Item | Why | Size |
|---|---|---|

## Open — needs the owner

| # | Item | What is needed |
|---|---|---|
| 13 | Restrict the two Firebase keys | Firebase Console: package name + SHA-256. **The repository is public** — restriction is the only control |
| 14 | Branch protection on `main` | Required check: `all checks passed` |
| — | Actions on a public repository | Settings → Actions: require approval for outside collaborators |
| — | Database backups | `DATABASE_URL` and `BACKUP_S3_*` secrets — the `db-backup` workflow fails without them |
| 16 | Performance baseline | Access to production-like hardware; every number so far is from a 2-vCPU CI runner |
| 17 | FG-22 — argon2 parameters | Choose parameters and record the rationale in config; **do not lower them to fix timing** |
| 19 | AI chat | Who pays and how it is metered per tenant; the endpoints are public and anonymous today; what the model may see; behaviour when the provider is down |

## Later — features

| # | Item | Note |
|---|---|---|
| 18 | UI display screens | Needs a definition |
| 20 | Performance work | Blocked on #16 — measure first |
| 22 | Import phase 3 (contracts / installments / deposits) | Deferred by decision |
