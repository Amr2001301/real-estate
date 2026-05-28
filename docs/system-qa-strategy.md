# System QA Strategy

Cross-platform testing strategy for the Real Estate platform — Backend
(`apps/api`), Admin Dashboard (`apps/web-admin`), Public Website
(`apps/web-public`), Customer App (`apps/mobile/mobile_customer`), Staff
App (`apps/mobile/mobile_staff`). Companion to
[`mobile-release-guide.md`](mobile-release-guide.md) /
[`mobile-store-readiness.md`](mobile-store-readiness.md) /
[`mobile-backend-readiness.md`](mobile-backend-readiness.md).

This doc is the source of truth for "what is automated, what is manual,
what is deferred." Each section is dated; status reflects what shipped,
not what is planned.

---

## 0.7 Phase 7F — CI hardening + release-verify (2026-05-28)

The Playwright suites became stable at the end of Phase 7E (admin
auth-state refactor) — Phase 7F wires them into CI and ships one
local command that runs every gate.

### CI extension

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) now has 7
jobs:

| Job | When it runs | What it does |
| --- | --- | --- |
| `changes` | always | `dorny/paths-filter@v3` produces `api` / `mobile` / `webAdmin` / `webPublic` booleans |
| `build` | always | lint + typecheck + build (existing) |
| `api-unit` | `api` changed | Jest unit (mocked Prisma) — 984 tests |
| `api-e2e` | `api` changed | Jest e2e against real Postgres service; jest globalSetup applies migrations + e2e seed |
| `mobile-static` | `mobile` changed | `flutter analyze` + `flutter test` ×3 packages |
| **`web-admin-e2e`** (new) | `webAdmin` OR `api` changed | Postgres service + `prisma migrate deploy` + `prisma:seed:e2e` + `pnpm build` + start API + start `next start -p 3001` + `playwright test` |
| **`web-public-e2e`** (new) | `webPublic` OR `api` changed | Same shape as web-admin-e2e on port 3002 |

Path-filter targets:

- `webAdmin`: `apps/web-admin/**`, `packages/shared-types/**`, `packages/tsconfig/**`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`
- `webPublic`: `apps/web-public/**`, same shared/lockfile/CI

The two Playwright jobs gate on `webX OR api` because the web apps
depend on the API; an API change can break their e2e. They run only
when the area actually changed — PRs touching docs/mobile-only skip
both Playwright jobs entirely.

### CI secrets posture

| Secret family | Required in CI? | Why |
| --- | --- | --- |
| Firebase / FCM | **No** | Phase 6 wired graceful fallback; tests use only mocked push paths |
| Twilio | **No** | OTP provider falls back to `console` in dev mode; e2e doesn't go through SMS |
| R2 / Cloudflare | **No** | Phase 7C documented the `[200, 503]` tolerance for the 4 signed-download tests; without R2 creds the 503 branch silently passes |
| Android signing keystore | **No** | Mobile CI is `analyze + test` only; no APK/AAB builds in CI |
| iOS signing | **No** | Same — no archive in CI |
| Production DB | **No** | E2E uses the in-job ephemeral Postgres service container |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | yes (placeholders) | Min-length-16 placeholder strings inline in the workflow; no real secret |

**Hard rail**: e2e `TEST_DATABASE_URL` points at `realestate_e2e`
inside the service container, never at any developer or production
DB. The jest globalSetup guards (3 separate checks — see `apps/api/test/globalSetup.ts`)
refuse to start otherwise.

### scripts/release-verify.sh

One command, 8 sections. Skips Playwright cleanly when web servers
are not running; refuses backend e2e cleanly when `TEST_DATABASE_URL`
is unset. Non-destructive otherwise.

```bash
# Quick (no DB, no servers needed — 6 sections run, 2 skip):
bash scripts/release-verify.sh

# Full (requires Postgres + API + web servers running, and an e2e DB):
docker compose up -d postgres                                          # if not already
export TEST_DATABASE_URL=postgresql://postgres@localhost:5432/realestate_e2e?schema=public
(cd apps/api          && PORT=4001 DATABASE_URL="$TEST_DATABASE_URL" pnpm dev &)
(cd apps/web-admin    && PORT=3001 API_BASE_URL=http://localhost:4001 pnpm dev &)
(cd apps/web-public   && PORT=3002 API_BASE_URL=http://localhost:4001 pnpm dev &)
# wait for /health, /, /login to respond, then:
bash scripts/release-verify.sh
```

The 8 gates the script walks:

1. `pnpm --filter @rep/api test` — backend Jest unit
2. `pnpm --filter @rep/api test:e2e` (gated on `TEST_DATABASE_URL`) — backend Jest e2e
3. Web admin Playwright (gated on a working `:3001`)
4. Web public Playwright (gated on a working `:3002`)
5. `flutter analyze` + `flutter test` ×3 mobile packages
6. Zero Riverpod across mobile `lib/` + `pubspec.yaml`
7. Clean Architecture boundary greps (no `presentation→data`, no `domain→data`, no `domain→flutter`)
8. No-secrets grep across all Phase 7A→7F files

Verified locally **8/8 pass** with all three services up; non-running
sections skip cleanly with actionable next steps.

### Manual-pending items (carried forward)

These remain manual / external-credential-blocked and are NOT in CI
intentionally — see also `docs/mobile-store-readiness.md`:

- Mobile `integration_test` on a real device/emulator
- Firebase/FCM real-device push delivery test
- Twilio production OTP
- Final Android `applicationId` / iOS bundle ID
- Launcher icons + splash assets
- Android upload keystore + iOS Distribution cert
- TestFlight / Play Internal upload
- Production API URLs in `EnvConfig`
- WhatsApp / contact phone numbers in `EnvConfig`

## 0.6 Phase 7E — Signed-download UI + admin auth-state + me/* scope audit (2026-05-28)

### Signed-download UI (P1)

Phase 7D removed `pdfUrl` / `receiptUrl` / `fileUrl` from customer-
facing responses but the web-public Card components still tried to
render `<a href={contract.pdfUrl}>` and fell through to the "العقد
غير متاح بعد" fallback for every card. Phase 7E wires the UI to mint
a short-lived signed URL just-in-time on click.

Two new client components:

- [`DocumentDownloadByOwner`](../apps/web-public/src/components/account/DocumentDownloadByOwner.tsx) —
  given `(ownerType, ownerId)`, fetches `/api-proxy/me/documents?…`
  to find the first CUSTOMER_VISIBLE document, then
  `/api-proxy/me/documents/:id/download` to get the signed URL,
  then `window.open(signed.url, '_blank', 'noopener,noreferrer')`.
  Loading / empty / error states surfaced inline.
- [`DocumentDownloadById`](../apps/web-public/src/components/account/DocumentDownloadById.tsx) —
  same shape but takes a known `documentId` (used by the per-photo
  rows on the maintenance detail page).

Wired into 4 places: `ContractCard`, `PropertyCard`, `DepositCard`,
and the maintenance detail's documents list. The signed URL is
never persisted, never logged, never written into the rendered DOM
— `window.open` hands it to the new tab and forgets.

Live Playwright proof (extends Phase 7D's customer-portal spec):

| Assertion | Result |
| --- | --- |
| Contract page shows the "تحميل العقد PDF" button (not the "العقد غير متاح بعد" fallback) | ✅ |
| Deposit page shows the "تحميل الإيصال" button | ✅ |
| The contract page DOM does NOT contain the raw R2 key `contracts/e2e/customer1-contract.pdf` | ✅ (grepped via `document.body.innerText`) |
| All Phase 7D heading/empty-state assertions still hold | ✅ |

### Admin Playwright auth-state (P2)

Replaces 7 per-test `loginAsAdmin / Sales / Manager` calls with a
`globalSetup` that logs in each role ONCE, captures cookies +
localStorage, and writes them to gitignored `.auth/<role>.json`
files. Specs attach via `test.use({ storageState })` and skip the
form login entirely.

| Change | File |
| --- | --- |
| New global setup | [`apps/web-admin/e2e/global-setup.ts`](../apps/web-admin/e2e/global-setup.ts) |
| Config reference | [`apps/web-admin/playwright.config.ts`](../apps/web-admin/playwright.config.ts) (`globalSetup` field) |
| `.auth/` gitignored | repo-root `.gitignore` (`**/e2e/.auth/`) |
| Spec refactor | dashboard-smoke, sales-smoke, sales-manager-smoke, flow-a-admin-catalog, flow-b-admin-sees-lead, flow-cef-admin-sees-data (6 specs, all use `test.use({ storageState })`) |

**Result:** the full admin suite goes from "5+ failures due to
throttle when run together" to **12 passed + 1 skipped (Flow B
without env)** in 23.4s. The product-side login throttle stays in
place (3 logins per Playwright invocation, well under the 5/min
limit no matter how the suite grows).

### Pre-existing stale-test fixes (surfaced by P2)

The throttle was masking two stale assertions in
`sales-manager-smoke.spec.ts` that have been wrong since the manager
dashboard component was renamed. Phase 7E fixed both (selector-only,
no product change):

1. "Lands on manager dashboard home" — was asserting the
   section header `"أداء المندوبين"` and the empty-state
   `"لم يتم ربط أي مندوب مبيعات بهذا المدير بعد"`. The actual
   header is `"أداء فريق المبيعات"` and the empty state is `"لا يوجد
   مندوبو مبيعات بعد"` (verified by curling the live page).
2. "SALES self-view is not in the manager nav" — was asserting the
   `مستحقاتي وأهدافي` link is hidden from managers. The link IS
   shown by current product design (managers see their own
   compensation, same as sales). Test dropped with a comment so a
   future product change can restore it intentionally.

### Mobile integration smoke (P3)

**No emulator / simulator / physical device attached this session.**
`flutter devices` reports only macOS desktop + Chrome web; the
existing `integration_test/smoke_test.dart` scaffolds remain
`flutter analyze` clean. **Manual pending** — unchanged since
Phase 7A.1; run commands in §0.1.

### me/* scope audit (P4)

Two parts:

1. **Static-analysis audit** (an Explore subagent) walked each of
   the 7 routes the Phase 7C RBAC allow-list contains
   (`UsersController.me/updateMe` + `NotificationsController.{myList,
   unreadCount, markRead, markAllRead, registerDevice}`). For each,
   confirmed the service layer filters by `user.sub` and that no
   DTO accepts a field that could override the scoping. Verdict:
   **YES (scoped) on all 7**. Full file:line evidence in
   `project_system_qa_strategy.md` memory.

2. **Runtime cross-user denial spec**
   [`apps/api/test/e2e/me-scope.e2e-spec.ts`](../apps/api/test/e2e/me-scope.e2e-spec.ts)
   — 8 cases proving the static finding holds against real HTTP
   traffic + a real DB:

   | # | Test | Result |
   | --- | --- | --- |
   | 1 | `GET /v1/users/me` returns only the caller's row | ✅ |
   | 2 | `GET /v1/me/notifications` per-user, no cross-leak | ✅ |
   | 3 | `GET /v1/me/notifications/unread-count` per-user | ✅ |
   | 4 | **Cross-user denial — c1 cannot mark c2's notification read** | ✅ (target row stays unread) |
   | 5 | `read-all` only touches the caller's own rows | ✅ |
   | 6/7/8 | no-token → 401 on 3 representative routes | ✅ |

Seed extended (step 6): one in-app notification per customer
(`templateCode='phase7e_test'`) so the spec has a concrete row id
to try to cross-mark.

## 0.5 Phase 7D — Security fixes + supervisor flow + customer portal (2026-05-28)

Targeted fixes for the two Phase 7C findings + extension of the e2e
coverage. **Total backend e2e: 107 cases across 10 spec files,
stable.** Three product-behavior changes (all narrow security
redactions); all other gates green.

### Security fixes applied (P1 + P2)

1. **`/v1/contracts/me/contracts` no longer exposes `pdfUrl`.** The
   controller redacts the field to `null` after the service call.
   Admin views go through a separate code path (`@Get()` /
   `@Get(':id')`) and are unchanged. Spec
   [`flow-e-financial-documents.e2e-spec.ts`](../apps/api/test/e2e/flow-e-financial-documents.e2e-spec.ts)
   `E_SECURITY1` ASSERTS the new behavior (was a guardrail in 7C; is
   a hard assertion now) and also greps the response for the raw
   seeded R2 key to catch any future rename-leak.

2. **`/v1/me/deposits` no longer exposes `receiptUrl`.** Same shape
   as fix #1; admin endpoints unchanged. Spec `E_SECURITY2` is the
   regression guardrail.

3. **`/v1/me/maintenance-requests/:id` no longer embeds `fileUrl`
   inside `documents[]`.** Discovered by Phase 7D's P2 audit:
   `MaintenanceService.customerFindOne` was returning the full
   Document row inline (incl. permanent R2 path). Service now maps
   to the same safe metadata shape (`id, title, fileName, mimeType,
   category, createdAt`) that `/me/documents` already used. Spec
   `F_SECURITY` (in `flow-f-maintenance.e2e-spec.ts`) is the
   regression guardrail.

Customer reaches every private file through ONE flow:
`GET /v1/me/documents/:id/download` → short-lived signed URL.
The customer-app and customer-portal source paths already used this
flow for new downloads; the previous endpoints leaking permanent
URLs were the unintended bypass. UI side-effect: `ContractCard.tsx` /
`PropertyCard.tsx` / `DepositCard.tsx` in web-public now show
"العقد غير متاح بعد" (gracefully degrade — they already had a
null-branch). Wiring the click-to-signed-download is out of Phase 7D
scope (would be a UI feature change, not a security fix); carry-
forward to Phase 7E.

### Maintenance supervisor status machine (P4)

New spec [`flow-f-supervisor-status.e2e-spec.ts`](../apps/api/test/e2e/flow-f-supervisor-status.e2e-spec.ts)
exercises the SUPERVISOR_TRANSITIONS subset on a request the seed
now assigns to `maintenance@example.com` (seed step 6 extended to
flip `assignedAdminId` + start at ASSIGNED). 9 cases:

| # | Test | Result |
| --- | --- | --- |
| F_SUP1 | supervisor `/me/maintenance-requests` includes the assigned request | ✅ |
| F_SUP2 | ASSIGNED → IN_PROGRESS (DB asserted) | ✅ |
| F_SUP3 | customer detail reflects IN_PROGRESS | ✅ |
| F_SUP4 | IN_PROGRESS → RESOLVED | ✅ |
| F_SUP5 | customer sees RESOLVED | ✅ |
| F_SUP_NEG | RESOLVED → CLOSED rejected (admin-only) | ✅ |
| F_SUP_RBAC ×3 | SALES 403; CUSTOMER 403; no-token 401 | ✅ ✅ ✅ |

### Customer-portal Playwright proof (P3)

New helper [`apps/web-public/e2e/helpers/auth.ts`](../apps/web-public/e2e/helpers/auth.ts)
exports `loginAsCustomer(page)` — drives the real
`POST /v1/auth/customer/login` form. Selectors target
`autocomplete="email"` + `autocomplete="current-password"` for
stability against placeholder changes.

New spec [`apps/web-public/e2e/flow-ef-customer-portal.spec.ts`](../apps/web-public/e2e/flow-ef-customer-portal.spec.ts)
is **one test with one login** (deliberately not 3 separate tests —
the customer login endpoint has the same 5/min throttle as the
staff login, so 3 parallel browser logins would trip it). One
login → navigates to `/account/contracts`, `/account/deposits`,
`/account/maintenance` → asserts each page renders its Arabic
heading + the empty-state copy does NOT appear (proves the seeded
fixtures are reachable from the customer surface).

| Spec | Result |
| --- | --- |
| `flow-ef-customer-portal.spec.ts` (Phase 7D) | ✅ 1/1 (3.2s cold, 2.5s warm) |
| `flow-cef-admin-sees-data.spec.ts` (Phase 7C regression) | ✅ 2/2 |
| `flow-a-public-catalog` + `flow-a-admin-catalog` (Phase 7A regression) | ✅ 3/3 |
| `flow-b-public-info-request` + `flow-b-admin-sees-lead` (Phase 7B regression) | ✅ 2/2 |

### Pre-existing public-smoke triage (P5)

Both flagged flakes were **broken assertions**, not flaky tests:

1. **`public-smoke.spec.ts:9` "homepage renders the hero"** — the
   second assertion `getByText('فن العيش الراقي يبدأ من اختيارك
   الصحيح')` was checking a string that lives ONLY in `<meta
   name="description">` (verified by `curl | grep -B 2 -A 2 …`).
   `getByText` correctly never finds it (it scans visible content).
   Fix: removed the meta-only assertion. The remaining `getByRole
   ('heading', { level: 1 })` already proves the hero rendered.
2. **`public-smoke.spec.ts:28` "compare empty state"** — the text
   IS in an `<h3>` (per the live `/compare` HTML) but
   `getByText` was racing with React streaming hydration. Fix:
   switched to `getByRole('heading', { name: '…' })` — the
   role-based locator waits for the element to be mounted.

After fixes: **public-smoke 9/9 green.** No product copy changed.
[`apps/web-public/e2e/public-smoke.spec.ts`](../apps/web-public/e2e/public-smoke.spec.ts)
comments document the rationale inline so the rationale stays put.

The **login-throttle** issue when running the full admin smoke as
one `playwright test` invocation was investigated and **deferred**.
The proper fix is Playwright's auth-state pattern (save authenticated
context to a file at suite start, reuse across specs) — a meaningful
refactor of the admin smoke suite that doesn't fit Phase 7D's
"if time and low risk" budget. Individual specs still pass.

## 0.3 Phase 7C — Financial / Maintenance / Approval / RBAC (2026-05-28)

Four new backend e2e spec files + one cross-app Playwright proof + an
additive extension to the e2e seed. **Total backend e2e: 96 cases
across 9 spec files, stable over 4 consecutive full-reset runs.**

| Spec | Cases | Result |
| --- | --- | --- |
| `apps/api/test/e2e/flow-e-financial-documents.e2e-spec.ts` | 14 | ✅ 14/14 |
| `apps/api/test/e2e/flow-f-maintenance.e2e-spec.ts` | 13 | ✅ 13/13 |
| `apps/api/test/e2e/flow-d-reservation-approval.e2e-spec.ts` | 10 | ✅ 10/10 |
| `apps/api/test/e2e/rbac-route-coverage.e2e-spec.ts` | 1 | ✅ 1/1 |
| Phase 7A + 7B (regression) | 58 | ✅ 58/58 |

### What Flow E covers (financial + signed documents)

- Customer reads `/me/deposits` + `/v1/contracts/me/contracts` and sees
  their own rows only.
- Customer reads `/me/documents?ownerType=CONTRACT&ownerId=…` and gets
  only CUSTOMER_VISIBLE docs.
- Signed download via `/me/documents/:id/download` returns
  `{url, fileName, contentType, expiresIn}` with `expiresIn ≤ 300s`,
  `url` contains `X-Amz-Signature`, and the response body never
  contains the permanent R2 key. (Or 503 if R2 creds unset — see §0.4.)
- Cross-account access: customer1 cannot list customer2's documents
  (404 or empty); cannot download (404, no info leak).
- RBAC: 401 no token; 403 sales / broker / client (CLIENT is NOT
  the same as CUSTOMER on these endpoints — explicit gotcha test).
- **Discovered finding (NOT fixed):** `/v1/contracts/me/contracts`
  returns the full Contract row, including the permanent `pdfUrl`
  field. The Phase 7C spec `E_FINDING` PINs this current behavior so
  any future cleanup (remove `pdfUrl`, force signed-download-only) is
  intentional and the guardrail will tell you the day it ships.

### What Flow F covers (maintenance with photos)

- Customer creates a maintenance request → 201.
- Customer lists their own requests (own only); customer2 doesn't see
  them; admin sees all on `/v1/maintenance-requests`.
- Cross-account get → 404 (no info leak, per OwnershipService).
- `POST /me/maintenance-requests/:id/documents/presign` returns
  `{uploadUrl, key, publicUrl}` with the upload URL containing
  `X-Amz-Signature` (or 503 if R2 unset).
- Signed download for the seeded CUSTOMER_VISIBLE photo works (or 503
  if R2 unset).
- Cross-account download of customer1's photo by customer2 → 404.
- RBAC: 401 no token; 403 sales (can't create); 403 broker (can't
  list admin); 403 customer (can't list admin).
- **NOT covered (carry-forward to Phase 7D):** supervisor status
  transitions on a customer-created request. The seed doesn't assign
  a MAINTENANCE_SUPERVISOR to any request, and exercising the OPEN →
  ASSIGNED → IN_PROGRESS → RESOLVED machine deserves its own focused
  spec.

### What reservation approval covers

Admin transitions (Phase 7B deliberately skipped them as
`@PermissionsStrict` admin-only):

- `POST /:id/approve` — PENDING → APPROVED, `approvedAt` set, unit
  stays RESERVED.
- `POST /:id/reject` — PENDING → REJECTED, unit freed AVAILABLE.
- `POST /:id/cancel` — APPROVED → CANCELLED, unit freed AVAILABLE.
- `POST /:id/booking-payment/confirm` — `bookingPaymentStatus=PAID`,
  Deposit row created (BOOKING_AMOUNT, verified).
- `POST /:id/convert` — APPROVED + booking-paid → CONVERTED, Unit
  SOLD, Contract row created, customer linked.
- `POST /:id/convert` without booking payment → 400, status stays
  APPROVED.
- 401 no token; 403 sales / broker.

### What the master RBAC spec covers

Walks every controller HTTP route via `DiscoveryService` +
`Reflector.getAllAndOverride`. Asserts each route is either
`@Public()` or has `@Roles(...)`. Allow-list = the 7 routes below,
each one a deliberate "any authenticated user, scoped by user.sub at
the service layer" pattern (the global `JwtAuthGuard` enforces the
authentication; no role gate needed because the service queries are
already scoped). The allow-list is the audit anchor; future tightening
just removes the entry.

| Route group | Allow-listed methods | Why |
| --- | --- | --- |
| `/v1/me` profile (GET/PATCH) | `UsersController.me`, `UsersController.updateMe` | Self-profile, scoped by `user.sub` |
| `/v1/me/notifications/*` | `NotificationsController.myList`, `unreadCount`, `markRead`, `markAllRead` | Self-notifications, scoped by `user.sub` |
| `/v1/me/devices` | `NotificationsController.registerDevice` | Push-token registration for self |

**Surfaced as a Phase 7C finding** — these 7 routes were never
explicitly documented as deliberate "JWT-only + service-scoped".
Phase 7C records that decision; future routes that fit the pattern
should be added here so the spec keeps catching unintended drift.

### Cross-app Playwright proof (data-dependent)

| Spec | Cases | Result |
| --- | --- | --- |
| `apps/web-admin/e2e/flow-cef-admin-sees-data.spec.ts` | 2 | ✅ 2/2 |
| Phase 7A Flow A regression (admin + public) | 3 | ✅ 3/3 |
| Phase 7B Flow B regression (paired) | 2 | ✅ 2/2 |

The new admin spec asserts the seeded Customer1 maintenance request +
the seeded Customer1 DOWN_PAYMENT deposit are visible on the admin's
`/dashboard/maintenance` and `/dashboard/deposits` routes
respectively. Same service topology as Phase 7A.1 (API on :4001
against the e2e DB, admin :3001, public :3002).

**Customer-portal side of E/F is NOT covered live** — no prior
`loginAsCustomer` helper exists for the public website; customer-side
selectors haven't been hardened. Backend e2e (Flow E + F, 27 cases) is
the canonical source of truth for customer-side scoping + signed
downloads. Carry-forward to Phase 7D if and when the customer-portal
Playwright surface is built out.

## 0.4 R2 credentials in e2e

Phase 7C exercises the signed-download surface through the real
`R2Service.createPresignedDownload` and
`createPresignedUpload`. The service throws 503 ("Storage not
configured") when any of `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` /
`R2_SECRET_ACCESS_KEY` is unset.

- **Local runs**: `apps/api/.env` has all three set → tests get 200
  and the URL contains `X-Amz-Signature`. We never actually PUT or
  GET against the bucket — the signed URL is generated locally by
  the AWS SDK; no network traffic for generation.
- **CI runs without R2**: the four affected tests (E4, E5, F5, F6)
  assert `[200, 503].contains(status)`. The 503 branch is silent —
  the auth + ownership chain still ran before R2 was called, and
  the rest of the spec (cross-account 404, RBAC negatives, list
  scoping) does not depend on R2 at all.

This is the "deterministic stub mode" the Phase 7C scope requested —
not a fake URL, but a graceful 503 fallback that the assertions
tolerate. Documented so a future R2-mock landing (e.g. LocalStack)
can tighten the assertions back to `200 only` without touching the
spec bodies.

## 0.2 Phase 7B — Lead / Visit / Reservation E2E (2026-05-28)

Three new backend e2e specs + one cross-app Playwright proof + an
additive extension to the e2e seed. Backend e2e is now the source of
truth for Flows B/C/D; the Playwright proof exists to keep the
public-form → admin-list integration honest across UI changes.

| Flow | Spec file | Cases | Backend e2e result | Stability (3 runs) |
| --- | --- | --- | --- | --- |
| B (Lead) | `apps/api/test/e2e/flow-b-leads.e2e-spec.ts` | 14 | ✅ 14/14 | ✅ stable |
| C (Visit) | `apps/api/test/e2e/flow-c-visits.e2e-spec.ts` | 12 | ✅ 12/12 | ✅ stable |
| D (Reservation) | `apps/api/test/e2e/flow-d-reservations.e2e-spec.ts` | 11 | ✅ 11/11 | ✅ stable |

Combined with Phase 7A: **58 backend e2e tests pass** (health 2 +
Flow A 18 + B 14 + C 12 + D 11 + the Flow C 1 extra) across 5 spec
files, stable over 3 consecutive `pnpm test:e2e` runs.

### Cross-app Playwright proof (Flow B)

Two paired specs validate the public form → admin list data path live:

| Spec | Result | Stability |
| --- | --- | --- |
| `apps/web-public/e2e/flow-b-public-info-request.spec.ts` | ✅ 1/1 in 2.5s (1.4s on rerun) | ✅ |
| `apps/web-admin/e2e/flow-b-admin-sees-lead.spec.ts` | ✅ 1/1 in 3.3s (1.7s on rerun) | ✅ |

Coordination is via two shared env vars (`E2E_FLOW_B_NAME` +
`E2E_FLOW_B_PHONE`) that both specs read. Run order matters: the
public spec MUST run first (it creates the lead the admin spec asserts).

**Run command** (against the same Phase 7A.1 service topology —
API :4001 against the e2e DB, admin :3001, public :3002):

```bash
export SHARED_NAME="E2E Flow-B $(date +%s)"
export SHARED_PHONE="+96650099$(printf '%04d' $(( RANDOM % 10000 )))"

# Step 1: public submits the form
cd apps/web-public && \
  E2E_NO_WEBSERVER=1 E2E_BASE_URL=http://localhost:3002 \
  E2E_FLOW_B_NAME="$SHARED_NAME" E2E_FLOW_B_PHONE="$SHARED_PHONE" \
  pnpm exec playwright test flow-b-public-info-request

# Step 2: admin verifies the lead appears
cd ../web-admin && \
  E2E_NO_WEBSERVER=1 E2E_BASE_URL=http://localhost:3001 \
  E2E_FLOW_B_NAME="$SHARED_NAME" \
  pnpm exec playwright test flow-b-admin-sees-lead
```

### Phase 7B fixes (test/setup only — no product behaviour changed)

1. **Flow A `sampleUnitInP1Id` stability** —
   [`apps/api/test/helpers/seed-fixtures.ts`](../apps/api/test/helpers/seed-fixtures.ts)
   now picks the oldest **AVAILABLE** unit under p1 with `id` as a
   tiebreaker (the seed creates units in batch with identical
   `createdAt`, so ordering was non-deterministic). Flow D
   reservations flip a unit to RESERVED; without this filter Flow A
   could see its sample-unit ID disappear from the public catalog mid-
   suite (`/public/units` shows AVAILABLE only).

2. **Flow D unit picker uses opposite end** —
   [`apps/api/test/e2e/flow-d-reservations.e2e-spec.ts`](../apps/api/test/e2e/flow-d-reservations.e2e-spec.ts)
   `pickAvailableUnit` orders DESC + `id desc`, so it consumes the
   NEWEST AVAILABLE unit. Flow A picks from the head, Flow D from the
   tail — no collision as long as there are ≥2 AVAILABLE units under
   p1, which the seed guarantees.

3. **Flow D broker reservation requires `selectedDurationOptionId`** —
   the seeded `[e2e] Default Plan` has 2 duration options, and the
   broker create DTO refuses the request without one. The fixture now
   exposes `flowD.planP1DurationOptionId` and the spec passes it
   through.

### Pre-existing failures NOT introduced by Phase 7B

Per the user's "triage only if blocking" guidance — Phase 7B did NOT
fix these because none blocked any Phase 7B work:

- **`public-smoke.spec.ts:9` "homepage renders the hero"** and
  **`public-smoke.spec.ts:28` "compare empty state"** — Arabic-copy
  assertions fail (text IS in the served HTML per `curl` but
  Playwright's `getByText` doesn't match it). Same as flagged in §0.1.
- **`sales-smoke.spec.ts` + `sales-manager-smoke.spec.ts` throttling**
  when admin Playwright is run as a single `playwright test` invocation
  — the suite logs in as `sales@` and `manager@` enough times in a
  minute to hit the `/v1/auth/login` 5-req/min throttle. Each spec
  passes individually (verified). Workaround: run targeted specs; do
  not run the full admin suite back-to-back. Fix would be either a
  longer throttle window for test traffic or per-spec login token
  reuse — deferred.

## 0.1 Phase 7A.1 — Live validation (2026-05-28)

The Phase 7A Playwright proofs and `seed-e2e` flow were exercised
**live** against running services pointed at the e2e DB:

| Run | Result |
| --- | --- |
| `apps/web-public/e2e/flow-a-public-catalog.spec.ts` (run 1) | ✅ 2/2 in 8.4s |
| same spec (run 2 — stability) | ✅ 2/2 in 2.2s |
| `apps/web-admin/e2e/flow-a-admin-catalog.spec.ts` (run 1) | ✅ 1/1 in 7.0s |
| same spec (run 2 — stability) | ✅ 1/1 in 2.5s |
| Existing `dashboard-smoke.spec.ts` (no regression) | ✅ 1/1 |
| Existing `public-smoke.spec.ts` | 7/9 pass; **2 fail on pre-existing assertions** unrelated to Phase 7A (homepage hero copy + compare empty-state copy — text IS in the HTML per `curl`, but the Playwright `getByText` doesn't match; out of Phase 7A.1 scope) |
| Backend e2e against the same DB | ✅ 20/20 in 1.4s after a full `migrate reset --force` |
| Idempotency: re-seed without reset | ✅ no extra rows (row counts unchanged) |

**One real bug found and fixed** during 7A.1: `pnpm dev` (which runs
`nest start --watch`) typechecks the test directory under TS strict
mode, whereas `ts-jest` had been lenient. 12 `TS18048 / TS2322` errors
surfaced in `prisma/seed-e2e.ts`, `test/helpers/seed-fixtures.ts`, and
`test/globalSetup.ts` — all the same root cause: TypeScript can't
narrow array-index access (`const [p1, p2, p3] = projects` after a
`length < 3` check) and `split('?')[0]` returns `string | undefined`.
Fix added an explicit re-assertion + `?? ''` fallback; behaviour
unchanged. `pnpm typecheck` is now clean across the api package.

**Local service topology used** (chosen to not disrupt the dev API
on :4000):

| Port | Service | Notes |
| --- | --- | --- |
| 4001 | `apps/api` via `pnpm dev`, `DATABASE_URL=…realestate_e2e` | Isolated from the dev API on :4000 |
| 3001 | `apps/web-admin` via `pnpm dev`, `API_BASE_URL=http://localhost:4001` | |
| 3002 | `apps/web-public` via `pnpm dev`, `API_BASE_URL=http://localhost:4001` | |

After the run all three services were torn down via `kill -TERM`
to their process groups; the user's dev API on :4000 was never
touched.

**Mobile integration_test status:** no Android emulator / iOS simulator
/ physical device was attached. The scaffolds (
[apps/mobile/mobile_customer/integration_test/smoke_test.dart](../apps/mobile/mobile_customer/integration_test/smoke_test.dart)
and the staff counterpart) are syntactically valid and `flutter
analyze` clean, but cannot execute without a target. Per Phase 7A.1
scope: **marked as manual pending**. Local execution command:

```bash
# Customer (after `flutter emulators --launch <id>` or attaching a device):
cd apps/mobile/mobile_customer
flutter test integration_test/smoke_test.dart

# Staff:
cd apps/mobile/mobile_staff
flutter test integration_test/smoke_test.dart
```

**Pre-existing public-smoke flakes** (NOT introduced by Phase 7A; do
NOT fix as part of 7A.1 — flag for separate triage):
- `public-smoke.spec.ts:9` "homepage renders the hero" — text "فن
  العيش الراقي يبدأ من اختيارك الصحيح" is present in the rendered HTML
  but Playwright's `getByText` doesn't find it (likely CSS-hidden /
  off-screen / inside a non-text-accessible element).
- `public-smoke.spec.ts:28` "compare page shows the empty state with
  no ids" — same shape.

## 0. Phase 7A status (2026-05-28)

Phase 7A is the **System QA Foundation + Flow A proof of concept**. It
adds the test-user table, the additive idempotent e2e seed, the
real-Postgres jest-e2e harness (with hard DB-safety guards), the first
end-to-end test (Flow A — Catalog Sync), Playwright proof specs for
public + admin, mobile `integration_test` smoke scaffolds, and a CI
extension. **Flows B–H are deferred to Phase 7B.**

| Layer | Phase 7A status | Notes |
| --- | --- | --- |
| Backend unit tests (mocked Prisma) | **984 pass** (preflight baseline + post-change) | Unchanged from prior; seed refactor didn't regress |
| Backend e2e (real ephemeral Postgres) | **20 pass** (health 2 + Flow A 18) | New — runs against `TEST_DATABASE_URL`, fully reset+seeded per run |
| Web Playwright proofs | 3 cases added (2 in web-public, 1 in web-admin); validated via `--list` | Live execution requires API + both Next dev servers running — documented commands below; not yet wired to CI |
| Mobile integration_test | Scaffolds added per app (1 smoke each); local-only | Not in CI in 7A — emulator runners deferred to 7B |
| Mobile unit/widget tests | **231 pass** unchanged | core 28 + customer 91 + staff 112 |
| Static analysis | All clean | `flutter analyze` ×3, ESLint via existing CI |
| CI | New jobs: `api-unit`, `api-e2e`, `mobile-static` — gated by per-area path filters (via `dorny/paths-filter`) | Playwright and mobile-emulator jobs deliberately NOT added in 7A |

## 1. Test environments

| Env | Purpose | DB | Auth | Reachable |
| --- | --- | --- | --- | --- |
| **local** | Dev iteration | `realestate` (or whatever `apps/api/.env` `DATABASE_URL` points at) | Seeded passwords; OTP echoed in dev | `pnpm --filter @rep/api dev` on `:4000`, web on `:3001` / `:3002` |
| **local e2e** | Backend jest e2e | `realestate_e2e` (or any DB whose name contains `e2e`/`test`) | Seeded passwords from `prisma:seed:e2e` | Started fresh per `pnpm --filter @rep/api test:e2e` run |
| **CI e2e** | Automated PR gate | Ephemeral `postgres:16` GH Actions service container, DB `realestate_e2e` | Same | Spun up by the workflow; never reused across runs |
| **staging** | Pre-prod human QA | Real Postgres, isolated from prod | Real Twilio (or sandbox); real Firebase project | TBD — needs the deploy pipeline carry-forward from store-readiness §3 |
| **production-readiness** | Sign-off | Prod DB | Real Twilio + APNs | Manual gate; checklist in `mobile-store-readiness.md` §8 |

### Required environment variables (per env)

Already validated by `apps/api/src/config/env.validation.ts`:

- `DATABASE_URL` (required everywhere; for jest e2e, override per-run via `TEST_DATABASE_URL`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (min 16 chars; CI uses placeholder secrets)
- `REDIS_URL` (defaults to `redis://localhost:6379`)
- `NODE_ENV`, `PORT`, `API_BASE_URL`, `CORS_ORIGINS`

E2E-specific:

- `TEST_DATABASE_URL` — **required** for backend e2e; the jest globalSetup
  REFUSES to run without it.
- `SKIP_DB_RESET=1` — optional; skips the destructive reset+seed in
  globalSetup (useful for iterating against a previously-seeded DB).

For Playwright (existing):

- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` / `E2E_SALES_*` / `E2E_MANAGER_*`
  — override the seeded defaults. Never commit real credentials.
- `E2E_BASE_URL` — `:3001` for web-admin, `:3002` for web-public.

### Required seed data

- **Dev seed** (`prisma:seed`): admin, sales, manager, maintenance user,
  one demo client (phone-only), 8 lead sources, 5 maintenance categories,
  permission codes, optionally 4 public-demo projects (gated by
  `SEED_PUBLIC_DEMO=true`).
- **E2E seed** (`prisma:seed:e2e`): runs the dev seed first with
  `SEED_PUBLIC_DEMO=true` forced, then adds 5 e2e users (broker1, broker2,
  client, customer, customer2), 2 broker firms, and broker→project access
  grants per the canonical table in
  [`apps/api/prisma/SEED_USERS.md`](../apps/api/prisma/SEED_USERS.md).

Idempotent: running either seed twice on the same DB is a no-op
(everything is upserted or find-or-created).

## 2. Roles & test accounts

See [`apps/api/prisma/SEED_USERS.md`](../apps/api/prisma/SEED_USERS.md)
for the canonical table — emails, passwords (local/e2e only), roles,
purposes. Quick reference of who each test exercises:

| Role | Account | Used by |
| --- | --- | --- |
| `ADMIN` | `admin@example.com` | Admin Playwright dashboard smoke; Flow A A1/A2/A4 |
| `SALES` | `sales@example.com` | Admin Playwright sales smoke; Flow A A4/A7 |
| `SALES_MANAGER` | `manager@example.com` | Admin Playwright sales-manager smoke |
| `MAINTENANCE_SUPERVISOR` | `maintenance@example.com` | Future Flow F |
| `BROKER` (positive) | `broker1@example.com` | Flow A A5 (sees granted projects) |
| `BROKER` (cross-tenancy negative) | `broker2@example.com` | Flow A A6 (cannot see broker1's grants) |
| `CLIENT` | `client@example.com` | Future Flow B/C |
| `CUSTOMER` | `customer@example.com` | Future Flow D/E/F; Flow A A7 (wrong-role 403) |
| `CUSTOMER` (cross-account negative) | `customer2@example.com` | Future Flow E (ownership-guard regression) |

## 3. Flow A — Catalog Sync (implemented in 7A)

End-to-end proof that the project + unit catalog is consistent across
admin → public → staff → broker scopes. **18 backend e2e cases** (plus
2 health) + **3 Playwright proofs** + reused mobile widget assertions.

Mapping back to the strategy:

| # | Surface | Test | Where |
| --- | --- | --- | --- |
| A1 | Backend (admin) | `GET /v1/projects/:p1Id` as admin returns 200 with the seeded project | `apps/api/test/e2e/flow-a-catalog.e2e-spec.ts` |
| A2 | Backend (admin) | `GET /v1/units/:unitId` returns the seeded unit; sanity-check via direct prisma query | same |
| A3 | Backend (public) | `GET /v1/public/projects` / `/units` / `/projects/:id` work with NO auth | same |
| A4 | Backend (sales) | `GET /v1/projects` and `/v1/units` as SALES return the catalog | same |
| A5 | Backend (broker positive) | `GET /v1/portal/projects` as broker1 returns exactly `{p1, p2}` | same |
| A6 | Backend (broker negative) | `GET /v1/portal/projects` as broker2 returns exactly `{p3}`; does NOT contain p1/p2 | same |
| A7 | Backend (RBAC negatives) | 401 with no token; 403 as CUSTOMER on `/v1/projects`; 403 as SALES on `/v1/portal/projects` | same |
| A8 | Backend (guest) | Public endpoints OK without auth; protected endpoints 401; 404 for nonexistent | same |
| (web-public proof) | Web | `/projects` shows the seeded Arabic project name; `/units` lists at least one unit card | `apps/web-public/e2e/flow-a-public-catalog.spec.ts` |
| (web-admin proof) | Web | `/dashboard/projects` (after admin login) shows the seeded Arabic project name | `apps/web-admin/e2e/flow-a-admin-catalog.spec.ts` |

Mobile assertions live in unit/widget tests already (231 pass);
end-to-end "Customer App sees the same project" runs from `integration_test/`
locally, scaffold added but not assertion-rich until Phase 7B.

## 4. Running each layer

### Backend unit tests (mocked Prisma)

```bash
pnpm --filter @rep/api test
# 984 tests, ~4s
```

### Backend e2e (real ephemeral Postgres)

```bash
# 1) Make sure local Postgres is running (Docker compose or native).
# 2) Create a dedicated e2e DB (name MUST contain "e2e" or "test"):
psql -h localhost -U postgres -c "CREATE DATABASE realestate_e2e OWNER postgres;"

# 3) Point TEST_DATABASE_URL at it and run:
export TEST_DATABASE_URL="postgresql://postgres@localhost:5432/realestate_e2e?schema=public"
pnpm --filter @rep/api test:e2e
# 20 tests, ~3s after schema reset+seed (~10s total cold)
```

The jest globalSetup **refuses to run** unless ALL of the following hold:

1. `TEST_DATABASE_URL` is set;
2. `TEST_DATABASE_URL !== DATABASE_URL`;
3. the DB name parsed out of `TEST_DATABASE_URL` contains `e2e` or `test`.

It then runs `prisma migrate reset --force --skip-seed` followed by the
e2e seed, against the test DB only. Set `SKIP_DB_RESET=1` to skip the
destructive part during local iteration.

### Run the e2e seed standalone (no jest)

```bash
DATABASE_URL="postgresql://postgres@localhost:5432/realestate_e2e?schema=public" \
  pnpm --filter @rep/api prisma:seed:e2e
```

The seed is idempotent — running it twice produces no extra rows.

### Web Playwright proofs (Flow A)

These specs ARE data-dependent (unlike the existing resilient smokes) —
they require the API to be pointed at a DB seeded via `prisma:seed:e2e`
(or `prisma:seed` with `SEED_PUBLIC_DEMO=true`).

```bash
# Terminal 1 — API pointed at the seeded DB:
DATABASE_URL="postgresql://postgres@localhost:5432/realestate_e2e?schema=public" \
  pnpm --filter @rep/api dev

# Terminal 2 — web-public dev server:
pnpm --filter @rep/web-public dev
# Terminal 3 — web-admin dev server:
pnpm --filter @rep/web-admin dev

# Terminal 4 — run the Flow A proofs:
pnpm --filter @rep/web-public exec playwright test flow-a-public-catalog
pnpm --filter @rep/web-admin  exec playwright test flow-a-admin-catalog
```

The existing per-role smokes (`dashboard-smoke`, `sales-smoke`,
`sales-manager-smoke`, `public-smoke`) continue to work against any
seeded DB.

### Mobile integration smoke (local only)

```bash
# Customer App — attach a device or start an emulator, then:
cd apps/mobile/mobile_customer
flutter test integration_test/smoke_test.dart

# Staff App:
cd apps/mobile/mobile_staff
flutter test integration_test/smoke_test.dart
```

Scaffolds boot the dev entrypoint and assert the app reaches a first
screen without throwing — no backend required. **Not in CI in 7A.**
Emulator-attached integration suites land in Phase 7B.

## 5. What is automated NOW (Phase 7A)

- Static analysis on every PR (existing CI lint/typecheck/build).
- 984 backend unit tests + (PR-gated by path filter) 20 backend e2e tests
  + 231 mobile unit/widget tests.
- Per-role admin dashboard smoke (3 specs / 10 cases, existing).
- Public website smoke (1 spec / 9 cases, existing).
- Flow A cross-surface proof: backend (HTTP-level, real DB), public web,
  admin web (specs added; web specs are documentation-only in CI for
  Phase 7A — local execution validated).

## 6. What is still manual

- Mobile-against-real-API flows (Phase 7B target).
- Visual / accessibility audits.
- On-device push delivery (per `mobile-store-readiness.md` §2).
- Cross-app human run-through of Flows B–H (manual checklist in
  [`manual-qa-checklists.md`](manual-qa-checklists.md)).

## 7. What is deferred (Phase 7B)

- Flows B–H (lead journey, visits, reservations, financial+signed
  downloads, maintenance with photos, broker journey, RBAC negatives).
- Cross-app Playwright spec (admin creates → public+mobile see).
- Mobile emulator CI job.
- Master "every backend route has a guard" introspection test.

## 8. Flakiness mitigations (in 7A)

- `maxWorkers: 1` + `--runInBand` in `jest-e2e.json` — no DB races.
- Read-only Flow A specs — no per-test cleanup needed.
- `testTimeout: 30_000` — generous for CI's first prisma boot.
- Deterministic broker firm codes (`E2E-BROKER-1`, `E2E-BROKER-2`) +
  deterministic project ordering (`createdAt asc`) in fixtures.
- `loginAs()` throws loudly on a non-2xx with the offending body
  inlined — failure messages tell you *what* broke.
- Twilio / Firebase / R2 stay unconfigured in e2e — their graceful
  "no-creds" fallbacks already exist and are exercised by the unit tests.

## 9. Hard DB-safety rails

Documented in `apps/api/test/globalSetup.ts` and proven by the test
suite during Phase 7A. Together they make it impossible for the e2e
harness to reset the dev DB — even if `TEST_DATABASE_URL` is
mis-configured.

| Guard | Failure mode caught | Error |
| --- | --- | --- |
| `TEST_DATABASE_URL` required | Running the suite with no test DB set | "TEST_DATABASE_URL is required" |
| `TEST_DATABASE_URL !== DATABASE_URL` | Copy-pasting the dev URL into the test URL | "TEST_DATABASE_URL equals DATABASE_URL" |
| DB name must contain `e2e` or `test` | Typed a different URL that points at a real DB by name | "Refusing to reset database \"<name>\"" |

## 10. Carry-forward into Phase 7B

- Flows B–H end-to-end specs (per the strategy doc's §E matrix).
- Cross-app Playwright spec (boots api + both web servers in one config).
- Mobile `integration_test` against the live API (KVM Linux runner gated
  by `[ci-mobile]` label).
- Master "every controller route is guarded" introspection spec.
- Negative RBAC web specs (e.g. SALES tries `/dashboard/bonus`).
