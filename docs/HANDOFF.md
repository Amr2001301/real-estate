# Handoff — where the work stands (2026-10-16)

> Read this first if you are picking up this repository in a new Claude session.
> The owner writes in Egyptian Arabic; code, commits, PRs and docs are in English.

---

## ملخص سريع (للمالك)

**إحنا فين:** خلصنا 3 جولات «سيناريوهات» كاملة على المنصة. كل جولة: نمشي سيناريوهات بيع وتحصيل حقيقية في الكود، نلاقي الأخطاء، تاخد إنت القرارات، وبعدين نصلّح على أجزاء، كل جزء PR لوحده بيتدمج لما الـ CI يخضر. آخر PR اتدمج هو **#86**. الفرع الرئيسي (main) نضيف، ومفيش شغل مفتوح.

**الجولة الرابعة:** المراجعة خلصت، و**وافقت على كل الاقتراحات** (القسم 4 تحت). التنفيذ **لسه ما بدأش** بطلب منك. الخطة 4 أجزاء: U1 أمان وخصوصية، U2 فلوس، U3 العميل والمهام التلقائية، U4 التقارير. أول حاجة تتعمل: أرقام عمولات البروكرز (واقفة عند كل الشركات بعد الأولى).

**حاجات عليك إنت:** الاستضافة، تقييد مفتاح Firebase، حماية الفرع الرئيسي على GitHub، وتسميات الرسوم في تطبيقات الموبايل (محتاجة جهاز عليه Flutter).

**إزاي تكمّل من أكونت تاني:** افتح جلسة Claude Code على نفس الريبو، وقوله: «اقرأ `docs/HANDOFF.md` وكمّل الجولة الرابعة من U2». كل اللي محتاجه مكتوب هنا.

---

## 1. Working agreement (how this project is run)

- **Branch:** develop on `claude/great-darwin-cm999x` (or whatever branch the new session is given). After a PR merges, restart the branch from `origin/main` before new work.
- **One PR at a time.** Each PR is one coherent slice (e.g. "U2 money"). The owner's standing approval: *«لما يخلص و يخضر اعمل ميرج و أبدا في الي بعده»* — when CI is all green, squash-merge (with `expectedHeadSha`), then start the next slice.
- **Every fix gets an e2e test that fails on the old code.** Verify by stashing `apps/api/src` (`git stash push --include-untracked -- apps/api/src`), running the new spec (expect failures), then `git stash pop`.
- **Every new e2e spec must be added to the `ci.yml` e2e-2 `--testPathPattern`** (the long `"…|e2e-plan-amendments"` list, ~line 429), or CI never runs it.
- **Run the full API unit suite before pushing** — mocks in unrelated specs often need a new Prisma method (e.g. `contractAmendment`, `setting.findMany`, `auditLog`).
- **Never commit `dump.rdb`** (Redis writes it to the repo root / `apps/api`). Delete it.
- Commit and PR texts must not name a model. PR bodies end with the Claude Code footer.
- Read `CLAUDE.md` — its rules (tenant scoping, migrations, security-spec vm rules, `zz_test_` objects, "never widen a security assertion") are binding.

### Local environment (cloud container)

```bash
service postgresql start; redis-server --daemonize yes      # after every container restart
pnpm install && pnpm db:generate
```

Databases: `realestate_pw` (dev) and `realestate_e2e` (tests), both at `postgresql://postgres:postgres@localhost:5432/`.

```bash
# API unit
cd apps/api && NODE_ENV=test DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
  JWT_ACCESS_SECRET=ci-access-secret-placeholder-1234567890 JWT_REFRESH_SECRET=ci-refresh-secret-placeholder-1234567890 \
  REDIS_URL=redis://localhost:6379 npx jest src

# API e2e (add the same JWT/REDIS vars)
TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/realestate_e2e?schema=public' \
DATABASE_URL=postgresql://ci:ci@localhost:5432/ci_placeholder DEFAULT_COMPANY_ID=00000000-0000-0000-0000-000000000001 \
  npx jest --config ./test/jest-e2e.json --runInBand [pattern]

# Security suite: same env, -c test/jest-security.json --runInBand
```

- Security test **A9-2 always fails locally** (needs MinIO → 503). It passes in CI. Not a regression.
- Web-admin has no Jest; check it with `npx tsc --noEmit` and `npx eslint` inside `apps/web-admin`.
- Prettier: many files on `main` are not Prettier-clean and CI does not check formatting — don't reformat whole files.

### Migrations (no TTY here — `prisma migrate dev` can't run)

1. Write `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` (and update `schema.prisma`).
2. Apply to **both** DBs: `psql postgresql://postgres:postgres@localhost:5432/realestate_pw < …/migration.sql` and the same for `realestate_e2e`.
3. `npx prisma migrate resolve --applied <timestamp>_<name>` against each DB.
4. Verify no drift: `npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --exit-code` → 0.
5. `npx prisma generate`.
- New permissions are only seeded by `seed.ts`, so a new permission also needs a migration that inserts it (see `20261016100000_approve_discount_permission`).
- `ALTER TYPE … ADD VALUE` for enums (see `20261016110000_amendment_price_reschedule`).

### Known CI flake

`report-pdf.service.spec.ts` (Chromium launch, 30 s timeout) failed on #80 and #84 and passed on re-run. If it fails again, **make the test robust** (raise the timeout / skip launch when Chromium is absent in a way that still asserts) — don't just re-run.

---

## 2. What has been done (merged PRs)

Earlier work (#18–#79): deposits linked to payment instruments and cheques, deposit reversal, company currency everywhere, branded report PDFs/XLSX via Chromium, notifications (all events, preferences, retries), cancellation with refunds, one live sale per unit, staff offboarding, broker suspension, subscription enforcement, late-payment fee setting, contract transfer (تنازل) and unit swap (تبديل), broker portal hardening, maintenance following the owner.

This session:

| PR | Slice | Main points |
|---|---|---|
| #80 | Data import | All-or-nothing, no duplicates. |
| #81 | S2 + S3 | `DepositType.FEE` for fee/penalty payments; deposits export names who paid *at payment time* (`ownerIdAt`). |
| #82 | T1 security & privacy | OTP login only for CLIENT/CUSTOMER; draft projects hidden publicly; no facets on public units; parents looked up tenant-scoped before child create; `/me/deposits` and contract documents windowed by transfer date; web-public `/api-proxy` 404s for an unknown domain (API default-company fallback kept for mobile); registration doesn't reveal existing accounts. |
| #83 | T2 money | Final (balloon) payment counted once; amounts in cents, last row takes the remainder; month-end safe `addMonths`; **per-company timezone** setting `company.timezone` (default `Africa/Cairo`) used by the overdue sweep; only signed contracts are billed (`BILLABLE_PLAN_WHERE`); payments on their way stop reminders/overdue/late fees; plan-less reservations snapshot the unit price. PR body has SQL to find old contracts that double-count the final payment. |
| #84 | T3 sales pipeline | No reassign via general PATCH; `?unassigned=1` queue for ADMIN/SALES_MANAGER; manager assigns within their team; WON only via conversion; no LOST with a live reservation; reservation credited to the lead's rep; returning website visitor with a closed lead gets a new lead; no double-booked visits. |
| #85 | T4 inventory & pricing | No deleting a building/phase/unit with deals; live-deal units can't change price/details; RESERVED never manual, SOLD needs a reason; **discount cap** setting `pricing.maxDiscountPct` + permission `pricing:approve-discount`; plan template price must equal unit price; archived projects can't be reserved/sold. |
| #86 | T5 plan changes | `POST contracts/:id/price` (price change; unpaid rows absorb it; discount cap applies), `POST contracts/:id/reschedule` (unpaid monthly rows spread over N months, total unchanged, old rows CANCELLED), `POST deposits/batch` (one cash/transfer payment for several installments), `POST deposits/settle` (early settlement). Contract page has a "Payments & plan changes" section. e2e `e2e-plan-amendments`. |

Shared helpers worth knowing (API): `common/utils/add-months.ts`, `common/time/company-timezone.ts`, `common/finance/*` (`COLLECTED_DEPOSIT_WHERE`, `BILLABLE_PLAN_WHERE`, `LIVE_CONTRACT_WHERE`), `installments/discount-policy.ts`, `projects/inventory-blockers.ts`, `common/ownership/ownership.service.ts`, `contracts/contract-amendments.service.ts` (`rescaleUnpaid`, `followNewPrice`, `liveContract`, `assertNoWaitingPayments`).

---

## 3. Round 4 — the plan (approved, NOT started)

Found by four read-only scenario audits on 2026-10-16. The top items were re-checked by hand. Paths are under `apps/api/` unless noted. Line numbers are as of `main` @ `bd3e46a`.

**Recommended order: U2 → U1 → U3 → U4** (U2 first because broker commissions are broken for every company after the first).

### U2 — Money

1. **Commission / payout numbers clash across companies (CRITICAL).** `commissionNumber @unique` (`prisma/schema.prisma:2420`) and `payoutNumber @unique` (`:2497`) are global; the generators (`broker-commissions.service.ts:548-561`, `broker-payouts.service.ts:464-477`) count per tenant → the second company's first commission collides, materialization fails forever; payouts 500. Fix: migration to `@@unique([companyId, commissionNumber])` / `@@unique([companyId, payoutNumber])` (pattern: `20261016050000_reservation_number_per_company`), retry on clash. Check the P2002 handler at `broker-commissions.service.ts:300-319`.
2. **Resubmitted proof pays an installment at a stale amount; or reopens review on a CANCELLED row.** `deposits.service.ts` resubmit (~1216-1283) checks only `PAID`; `approveProof` (~1286-1340) never compares amounts; `assertNoWaitingPayments` (`contract-amendments.service.ts` ~205-228) only blocks on PENDING_REVIEW, not REJECTED. Fix: resubmit requires installment PENDING/OVERDUE and amount equal; approve refuses a mismatch.
3. **Amendment vs. proof race.** Amendments check waiting payments before the transaction; customer submit is check-then-create. Re-check inside the amendment transaction (lock the plan's open rows).
4. **Unit swap bypasses the discount cap and archived-project block.** `swapUnit` (`contract-amendments.service.ts:635+`): select `unit.price`, call `assertDiscountAllowed` + `assertUnitOnSale` (as `changePrice` does at ~454-468).
5. **`releaseUnit` can free a resold unit and wipe the new buyer's warranties.** `contract-cancellation.service.ts:504-549`: require unit still SOLD and no other live contract on it; else mark released without touching the unit.
6. **Reschedule accepts a past `startsAt`** (`contract-amendments.service.ts` reschedule) → rows born overdue, late fees. Require `startsAt >= company-local today`.
7. **Payout / bonus status races** (`broker-payouts.service.ts:317-456`, `bonus.module.ts:471-500`, `contract-cancellation.service.ts:130-133, 220-275`): use `updateMany({ where: { id, status: expected } })`, zero count → 409; re-read inside the cancellation transaction.
8. **Clawback collection uncapped / lost update** (`clawback-resolution.service.ts:58-82, 213-237`): reject above outstanding; atomic increment with a status guard.
9. **Commission follows price changes** (`followNewPrice`, `contract-amendments.service.ts` ~397-435) — apply decisions 3 & 4 below: commission on a DRAFT/APPROVED payout is recomputed and the payout goes back to DRAFT; an APPROVED commission/bonus whose amount changes returns to PENDING; after PAID: decrease → clawback, increase → top-up entry; outstanding clawbacks are netted against the broker's next payout.
10. **Commission base** (decision 3): compute on the net price after discount, **excluding** the instalment financing markup (`increasePercentage`). Today it is `contract.totalAmount` (`reservations.module.ts` ~1982-1985, `installments/duration-calc.ts`).
11. **RETAIN on cancellation actually payable** (decision 6): `broker-commissions.service.ts:383-387`, `broker-payouts.service.ts:148, 243, 279`, `bonus.module.ts:483-485` currently block it.
12. **Suspended broker at signing** (decision 5): pays if the reservation was made while the broker was active; record skips as visible sign follow-up failures; re-run materialization on reactivation (`broker-commissions.service.ts:158-164`, `brokers.service.ts:240-310`).
13. Manual bonus entries: validate `salesId`/`ruleId` belong to the company and are active (`bonus.module.ts:270-345, 505-520`). Bonus for a rep who left (decision): **hold for review**.

### U1 — Security & privacy

1. **Phone change without verification** → a typo hands the account to whoever owns that number. `users.service.ts:380-411` + `auth.service.ts:846-858`. Fix: two-step change confirmed by OTP to the new number; OTP login must not land on an account whose phone was set by an unverified profile edit.
2. **`GET /me/contracts` leaks broker commission and broker-agent contact** (`contracts.module.ts:1226-1264` reuses the admin `list()` select at ~631-660). Give it its own select.
3. **Broker portal leaks:** `/portal/performance` (`broker-portal.controller.ts:256-309`, `broker-portal-performance.service.ts:24-45`, `broker-reports.service.ts:252-309, 1276-1350`) shows any agent firm money and other agents' clients — apply `agentFilter(viewer)` and `withoutMoney()` when `!canViewCommissions`; same for `/portal/me` and `/portal/projects` rates (`broker-portal.service.ts:44-45, 115-116`). `/portal/commissions` (`broker-portal-commissions.service.ts:8-19, 54-82`): add `agentFilter` and `brokerFacingPerson`.
4. **Broker manager can grant themselves `canViewCommissions`** (`broker-portal-team.service.ts:190, 278-280`): admin-only; default `false` for new members.
5. **Broker project access `startsAt`/`endsAt` never enforced** (`broker-access.service.ts:93, 119`; lookups in `broker-portal-reservations.service.ts:604-646`, `broker-portal.service.ts:84-140`, `broker-portal-leads.service.ts:247-285`, `broker-commissions.service.ts:194-197`).
6. **Maintenance attachments accept any storage key / external URL** (`maintenance.service.ts:1192-1211`, `documents.module.ts:72-104`): accept only keys presigned for this user.
7. **Maintenance category `code` globally unique** (`schema.prisma:1948`, migration `20260522130000_add_maintenance_category_sla`): per-company unique; map P2002 to 400.
8. **After a transfer** (decision 8): close the old owner's open maintenance requests instead of handing them (and their photos) to the new owner (`contracts/unit-warranties.ts:53-66`); booking deposits stay with the payer — split by transfer date using `createdAt`, not customer-entered `paidAt` (`ownership.service.ts:90-127`, `deposits.controller.ts:266-275`, `contract-amendments.service.ts:286-291`).

### U3 — Customer app & background jobs

1. **Cancelled rows shown as owed** after a reschedule: `GET /me/installments` returns CANCELLED (`installments.module.ts:1641-1648`); mobile treats unknown status as pending (`apps/mobile/mobile_customer/lib/features/installments/...`). Fix API side (exclude by default) and add a `cancelled` state in the app (Flutter — can't be run in the cloud container; CI runs `flutter analyze`/tests). Specific error for a proof on a cancelled row (`deposits.service.ts:1032-1036`).
2. **Notify the customer** on reschedule and price change (new templates, e.g. `contract_rescheduled`, `contract_price_changed`; see how transfer/swap notify).
3. **Late fees / overdue for blocked companies and deleted/inactive customers** (`installments.module.ts:450-461, 537-583`): skip them; refuse deleting/deactivating a customer with a live contract (`users.service.ts:589-601`).
4. **Late-fee decisions (decision 7):** waive late-fee rows tied to installments cancelled by a reschedule; pause the late-fee clock while the company is blocked or a proof is under review; a transfer requires overdue rows and fees to be settled first.
5. **One "should be chased" filter** (signed + not waiting on a payment) used by the overdue sweep, reminders (`installments.module.ts:1447`) and the me-home banner (`me-home.module.ts:245-265`).
6. Reminder installment number counts cancelled/fee rows (`installments.module.ts:1550-1552`).
7. **Auto-closed maintenance stays actionable** (`unit-warranties.ts:72-84`): set `reviewStatus` too, include RESOLVED, and make `approve`/`assign`/customer-confirm refuse CLOSED (`maintenance.service.ts:643, 724, 974`).
8. Supervisor who leaves: IN_PROGRESS back to OPEN/ASSIGNED, RESOLVED reassigned (`users.service.ts:511-521`).
9. Warranty dates editable silently once started (`unit-maintenance-items.module.ts:136-176`): only extensions, with reason + audit.
10. **Handover (decision 1):** add a unit handover event (date + checklist); warranties start and maintenance unlocks at handover (today: contract creation, `contracts.module.ts:990-993`, `unit-warranties.ts:12`, `maintenance.service.ts:547`). New unit's warranty after a swap starts at the swap date (`contract-amendments.service.ts` ~808). This is the biggest new feature — schema + API + web-admin + mobile.
11. **Customer account deletion (decision 9):** "request deletion" in the app → deactivate + anonymise personal data, keep contract/payment records; refused while a live contract exists. Required by Apple/Google.

### U4 — Reports

1. **Broker leaderboard always empty:** `reports.service.ts:270-271` joins `"User"` on `bc."brokerId"`, which references `"Broker"`. Join `"Broker"` (+ companyId). Test ISO-R3 passes by accident.
2. **`dateTo` drops the last day** (`lte: new Date('YYYY-MM-DD')`): `reports.service.ts:148/153, 190, 1098, 1328, 1484, 1615, 1660`; `broker-reports.service.ts:990-996`. One helper: date-only `dateTo` → `lt` start of next day in the company timezone.
3. **Collection rate** on the financial page (`apps/web-admin/.../reports/financial/page.tsx:135,149`) disagrees with the dashboard: return `collectedTowardsPrice` from `financialDashboard` (as `adminSummary` does at `reports.service.ts:456-472`).
4. **Sales performance counts cancelled contracts:** `bonus.module.ts:631-634` add `LIVE_CONTRACT_WHERE`.
5. Computed overdue/aging use `LIVE_PLAN_WHERE` and ignore payments on their way (`reports.service.ts:1009, 1349-1396`): use `BILLABLE_PLAN_WHERE` + `PAYMENT_NOT_ON_ITS_WAY`.
6. **Reports in the company timezone** (all buckets are UTC today): `reports.service.ts:156, 293-303, 320-323, 991-1005, 1686-1697, 2511-2523`; `bonus.module.ts:151-160`.
7. Dashboard cash-flow forecast drops rows due today (`reports.service.ts:438-449` vs `1281`).
8. Batch payment receipt linked to the first deposit only (`deposits.service.ts` recordMany) → link to all.
9. `netCollected` with a type filter subtracts all refunds (`reports.service.ts:1733-1760`).
10. **Decision 2:** show "collected towards price" and "fees & penalties" as two separate figures; a sale is counted by **`signedAt`** everywhere (reports page and `salesTrend` currently use `createdAt`).
- Left as is (not decided otherwise): sales use the current (amended) price; inventory "sold value" uses list price; "number of payments" counts deposit rows.

---

## 4. Decisions the owner approved for round 4 (2026-10-16, «موافق»)

1. **Warranty & maintenance start at a new unit "handover" event** (date + checklist). After a swap, the new unit's warranty starts at the swap date.
2. **Collected:** two figures — collected towards price, and fees & penalties. A sale counts by **signing date** everywhere.
3. **Commission & sales bonus base:** net price after discount, without the instalment markup.
4. **Price change after approval/payment:** approved → back to PENDING for re-approval; paid and price down → clawback for the difference, netted automatically against the broker's next payout; price up → top-up entry.
5. **Broker suspended at signing:** earns the commission if the reservation was made while active. Two brokers with the same client: first to register wins; admin can override.
6. **RETAIN on cancellation:** the commission/bonus remains payable.
7. **Late fees:** waived automatically on rescheduled rows; clock paused while the company is blocked or a proof is under review; a transfer requires overdue amounts to be settled first.
8. **After a transfer:** the old owner's open maintenance requests are closed (new owner files new ones); booking receipts stay with the payer.
9. **Customer account deletion:** "request deletion" in-app → deactivate + anonymise, keep financial records; not allowed while a live contract exists.
- Also: bonus for a rep who left → held for review.

---

## 5. Other open items

- **Old contracts that bill the final payment twice** (converted before #83): the SQL to find them is in the #83 PR body. Fix each from the contract page with a price change or reschedule (#86), or write a one-off fix script — ask the owner first.
- **Mobile fee labels:** the customer app shows a FEE payment as a normal "payment", the staff app prints `FEE`. Needs Flutter (not available in the cloud container).
- **Owner's own tasks:** hosting/deployment, restricting the Firebase API key, GitHub branch protection on `main`.
- Older backlog docs: `docs/BACKLOG.md`, `docs/EXECUTION_BACKLOG.md`, `docs/PROJECT_CURRENT_STATE.md` (may be behind this file).
