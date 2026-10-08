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
| FG-01 | `Deposit.paymentInstrumentId` was never set, so clearing or bouncing a cheque touched no deposit | Decided 2026-10-08: cheque → unpaid until it clears; transfer → collected at once; one cheque per installment. API: PR #18. UI: payment method on the deposit form, `/dashboard/cheques` (deposit, clear, bounce, cancel) |
| 15 | Split the security suite (31 min) | Not needed: the job lacked Redis; with it the suite runs in ~1.5 min (PR #9, G16). A Redis outage no longer stalls the API either (PR #10) |

## Open — can be done in the repo

| Item | Why | Size |
|---|---|---|
| Leaflet map in `next dev` | On the project page under `next dev`, react-leaflet 4 throws "Map container is already initialized" (Strict Mode mounts effects twice) and the map does not render. Dev only — production builds render it; same on Next 15.5. react-leaflet 5 targets React 19 | S |
| FG-05 residuals | Reverse only works on APPROVED deposits; no double-reversal guard; soft-delete leaves the installment PAID | M |
| FG-13 residual | Admin confirm deletes a rejected customer proof's deposit and orphans its document | S |
| FG-04 | InfoRequest RESPONDED/CLOSED have no write path; contract number unreachable for direct contracts | M |
| FG-10, FG-14, FG-15 | Swallowed materialisation on sign; no promotion notice; no `updatedAt` on Phase/Building | S each |
| Web-public / portal i18n (#21) | The broker portal is Arabic-only, hard-coded | M |

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
