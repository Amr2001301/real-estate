# Manual testing access sheet

> **All credentials and URLs in this file are for local development, E2E,
> and staging only.** The values mirror what is already committed to
> [apps/api/prisma/SEED_USERS.md](../apps/api/prisma/SEED_USERS.md),
> [apps/api/prisma/seed.ts](../apps/api/prisma/seed.ts), and
> [apps/api/prisma/seed-e2e.ts](../apps/api/prisma/seed-e2e.ts). They are
> useless against production — production runs on separate databases with
> separate secret credentials. **Never** set any password from this file on
> a non-local database, and **never** paste a real production token here.

Companion to [manual-qa-checklists.md](manual-qa-checklists.md) and
[system-qa-strategy.md](system-qa-strategy.md). This sheet is the "where
do I click / type / login" reference; the checklists are the "what do I
verify" reference.

---

## 1. Local / E2E running links

### Default ports

| Surface | URL | Owner |
| --- | --- | --- |
| Backend API (NestJS) | http://localhost:4000 | `apps/api` |
| API v1 prefix | http://localhost:4000/v1 | — |
| Swagger / OpenAPI docs | http://localhost:4000/docs | — |
| API health check | http://localhost:4000/health | — |
| API root info | http://localhost:4000/ | — |
| Admin Dashboard (web) | http://localhost:3001 | `apps/web-admin` |
| Public Website | http://localhost:3002 | `apps/web-public` |
| Customer Account portal | http://localhost:3002/account | (lives inside web-public) |
| Broker workspace (web) | http://localhost:3001/portal | (lives inside web-admin, role-gated to BROKER) |
| Sales / Sales Manager workspace | http://localhost:3001/dashboard | (lives inside web-admin) |
| Maintenance "go-to-app" page | http://localhost:3001/maintenance-app | (info page only — maintenance is mobile-only) |

> Postgres lives on `localhost:5432`, Redis on `localhost:6379` by default
> (configurable via `.env` — see `docker-compose.yml`).

> Local object storage runs on MinIO at `localhost:9000` (S3) /
> `localhost:9001` (console). See
> [docs/local-minio-storage.md](local-minio-storage.md) for the setup.
> Production continues to use Cloudflare R2 — no code paths change.

### Start commands

Run each in its own terminal from the repo root unless noted.

```bash
# Infrastructure (postgres + redis) — once per machine session
docker compose --profile infra up -d

# Backend API (NestJS, http://localhost:4000)
pnpm --filter @rep/api dev

# Web Admin (Next.js, http://localhost:3001)
pnpm --filter @rep/web-admin dev

# Web Public (Next.js, http://localhost:3002)
pnpm --filter @rep/web-public dev
```

### Database seeds

```bash
# Dev seed — admin + sales + manager + maintenance supervisor + 1 demo client
# Idempotent (upserts). Safe to re-run.
pnpm --filter @rep/api prisma:seed

# Same, plus the 4 public-website demo projects with units + media.
SEED_PUBLIC_DEMO=true pnpm --filter @rep/api prisma:seed

# E2E seed (additive: forces SEED_PUBLIC_DEMO=true, then adds brokers,
# customers, contracts, deposits, maintenance, notifications, plan, etc.).
# Direct invocation writes to DATABASE_URL — point that at a dedicated
# non-production database before running.
pnpm --filter @rep/api prisma:seed:e2e
```

When the e2e suites invoke the seed via Jest globalSetup, they enforce
that `TEST_DATABASE_URL` is set, differs from `DATABASE_URL`, and that
its DB name contains `e2e` or `test`. Direct CLI runs do **not** have
that guard — see "Safety rails" in
[apps/api/prisma/SEED_USERS.md](../apps/api/prisma/SEED_USERS.md).

### Release verification (all gates, non-destructive)

```bash
# Walks 8 gates (unit, e2e, web-admin Playwright, web-public Playwright,
# mobile analyze+test, no-Riverpod, clean-architecture boundaries, no-secrets).
# Skips gates whose prereqs are not met instead of failing.
scripts/release-verify.sh

# Include the backend e2e gate (real Postgres). Point this at a dedicated
# e2e DB whose name contains "e2e" or "test" — the seed refuses anything else.
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/realestate_e2e \
  scripts/release-verify.sh
```

---

## 2. Mobile app run commands

Each Flutter app has three flavor entrypoints (env baked at compile-time;
override the API URL at run-time via `--dart-define=API_BASE_URL=...`).

```bash
cd apps/mobile && flutter pub get   # once per checkout

# Customer App — dev (default points at http://localhost:4000/v1)
cd apps/mobile/mobile_customer
flutter run -t lib/main_dev.dart

# Customer App — staging (constants point at https://staging-api.example.com/v1)
flutter run -t lib/main_staging.dart

# Staff App — dev
cd apps/mobile/mobile_staff
flutter run -t lib/main_dev.dart

# Staff App — staging
flutter run -t lib/main_staging.dart

# Prod entrypoints exist but should not be used for manual QA against
# local/staging — they bake the production API URL.
```

### Android emulator host quirks

Android emulators **cannot reach the host's `localhost`**. Use one of:

```bash
# Standard Android emulator (AVD): host loopback is 10.0.2.2
flutter run -t lib/main_dev.dart \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000/v1

# Genymotion: host loopback is 10.0.3.2
flutter run -t lib/main_dev.dart \
  --dart-define=API_BASE_URL=http://10.0.3.2:4000/v1

# Physical device on the same Wi-Fi: use the host's LAN IP
flutter run -t lib/main_dev.dart \
  --dart-define=API_BASE_URL=http://192.168.1.10:4000/v1
```

iOS simulators **can** reach `localhost` directly — no override needed.

### Staging note

`EnvConfig.staging` ([apps/mobile/packages/core/lib/src/env/env_config.dart:47](../apps/mobile/packages/core/lib/src/env/env_config.dart#L47))
currently points at the placeholder `https://staging-api.example.com/v1`.
**A real staging API URL has not been wired yet.** Override with
`--dart-define=API_BASE_URL=...` until that is updated (or until a real
staging environment exists — see "Known limitations" below).

---

## 3. Test users and passwords

> **Local / E2E / staging only.** All passwords below are committed in
> the seed scripts and `SEED_USERS.md` — they are intentionally weak demo
> credentials. **Never set any of these on a production database.**

| # | Role | Email | Password | Phone | Logs in at | What to test with this account |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADMIN | `admin@example.com` | `ChangeMe123!` | — | Admin Dashboard `http://localhost:3001/login` | Full admin dashboard. All strict actions (approve / sign / verify / pay / publish). Holds every permission code. Override password via `SEED_ADMIN_PASSWORD` env. |
| 2 | SALES | `sales@example.com` | `SalesPass123!` | — | Admin Dashboard `http://localhost:3001/login` → `/dashboard`. Staff App. | CRM workflows: leads create/update/note/assign/advance, visits create/schedule/confirm/complete/reschedule/cancel/no-show, reservations create/update, read contracts/deposits/installments/units/projects. No financial mutations. |
| 3 | SALES_MANAGER | `manager@example.com` | `ManagerPass123!` | — | Admin Dashboard `http://localhost:3001/login` → `/dashboard`. Staff App. | Same tier as SALES; team view scoped to their reps. Manages user #2 (`sales@example.com`). |
| 4 | MAINTENANCE_SUPERVISOR | `maintenance@example.com` | `MaintenancePass123!` | — | Staff App only. Web `/login` lands on `/maintenance-app` info page (no web workspace). | Mobile-only. Read assigned maintenance requests; transition status ASSIGNED → IN_PROGRESS → RESOLVED. Pre-assigned to seeded `[e2e] Customer1 maintenance` request. |
| 5 | CLIENT (demo lead) | `ahmed@example.com` | — (no password) | `+966500000001` | Customer App via phone-OTP only. | Demo client tied to seeded Facebook lead on project #1 (`New Riyadh Compound`). Cannot log in with password. |
| 6 | BROKER | `broker1@example.com` | `BrokerPass1!!` | — | Admin Dashboard `http://localhost:3001/login` → `/portal`. Staff App (broker shell). | Broker firm `E2E-BROKER-1`. Has BrokerProjectAccess to projects p1 + p2 (creation-order). Drives Flow A test A5. `canViewCommissions=true`. Has a seeded APPROVED broker lead + installment plan on p1 ready for reservation creation. |
| 7 | BROKER | `broker2@example.com` | `BrokerPass2!!` | — | Admin Dashboard `http://localhost:3001/login` → `/portal`. Staff App (broker shell). | Broker firm `E2E-BROKER-2`. Has BrokerProjectAccess to project p3 only. Use for cross-broker isolation negative tests (Flow A test A6) — must **not** see broker1's grants. |
| 8 | CLIENT | `client@example.com` | `ClientPass1!!` | — | Customer App / public site `http://localhost:3002/login`. | Active client used by visit-request flows (future Flow B/C). |
| 9 | CUSTOMER | `customer@example.com` | `CustomerPass1!` | — | Customer App / public site `http://localhost:3002/login` → `/account`. | Has seeded contract (`[e2e] Customer1 contract PDF`), deposit (DOWN_PAYMENT 200k, verified), CUSTOMER_VISIBLE contract doc, maintenance request (`[e2e] Customer1 maintenance — leaky faucet`, assigned to user #4), and unread notification. Drives Flow E/F manual checks. |
| 10 | CUSTOMER | `customer2@example.com` | `CustomerPass2!` | — | Customer App / public site `http://localhost:3002/login` → `/account`. | Cross-account negative tests. Has own contract + CUSTOMER_VISIBLE doc + unread notification — must **not** be visible to customer #9 and vice versa. |

### Login matrix (what works where)

| User | Admin `/dashboard` | Broker `/portal` | Public site `/account` | Customer App | Staff App |
| --- | --- | --- | --- | --- | --- |
| admin | ✅ | ❌ (role-gated to BROKER) | n/a | ❌ | ❌ |
| sales | ✅ | ❌ | n/a | ❌ | ✅ (Sales shell) |
| manager | ✅ | ❌ | n/a | ❌ | ✅ (Sales shell) |
| maintenance | redirect → `/maintenance-app` info page | ❌ | n/a | ❌ | ✅ (Maintenance shell) |
| broker1 / broker2 | ❌ | ✅ | n/a | ❌ | ✅ (Broker shell) |
| ahmed (CLIENT, phone-OTP) | ❌ | ❌ | OTP only — no password | ✅ (phone OTP) | ❌ |
| client | ❌ | ❌ | ✅ | ✅ | ❌ |
| customer / customer2 | ❌ | ❌ | ✅ | ✅ | ❌ |

---

## 4. Manual QA links by role

All paths are relative to the appropriate host. Mobile entries are screen
labels, not URLs.

### Admin (logged in as `admin@example.com` at http://localhost:3001)

| Surface | Path |
| --- | --- |
| Dashboard home | `/dashboard` |
| Projects | `/dashboard/projects` |
| Units | `/dashboard/units` |
| Inventory (cross-project) | `/dashboard/inventory` |
| Leads | `/dashboard/leads` |
| Visits — appointments | `/dashboard/visits/appointments` |
| Visits — requests | `/dashboard/visits/requests` |
| Clients | `/dashboard/clients` |
| Customers | `/dashboard/customers` |
| Reservations | `/dashboard/reservations` |
| Contracts | `/dashboard/contracts` |
| Deposits | `/dashboard/deposits` |
| Maintenance | `/dashboard/maintenance` |
| Documents | `/dashboard/documents` |
| Installments | `/dashboard/installments` |
| Brokers (firms) | `/dashboard/brokers` |
| Broker leads | `/dashboard/broker-leads` |
| Broker reservations | `/dashboard/broker-reservations` |
| Broker contracts | `/dashboard/broker-contracts` |
| Broker commissions | `/dashboard/broker-commissions` |
| Broker payouts | `/dashboard/broker-payouts` |
| Broker reports | `/dashboard/broker-reports` |
| Bonus | `/dashboard/bonus` |
| Targets | `/dashboard/targets` |
| Reports — main | `/dashboard/reports` |
| Reports — financial | `/dashboard/reports/financial` |
| Operations | `/dashboard/operations` |
| Audit | `/dashboard/audit` |
| Audit logs | `/dashboard/audit-logs` |
| Notifications | `/dashboard/notifications` |
| Notification templates | `/dashboard/notifications/templates` |
| CMS | `/dashboard/cms` |
| Permissions | `/dashboard/permissions` |
| Settings | `/dashboard/settings` |
| Users | `/dashboard/users` |
| My compensation | `/dashboard/my-compensation` |

### Public website (http://localhost:3002)

| Surface | Path |
| --- | --- |
| Home | `/` |
| Projects listing | `/projects` |
| Project details (sample — seeded) | `/projects/{projectId}` — use the first project returned by `/projects` |
| Units listing | `/units` |
| Unit details (sample) | `/units/{unitId}` |
| Compare units | `/compare` |
| Login | `/login` |
| Register | `/register` |
| Download mobile app | `/download-app` |
| Contact | `/contact` |
| Privacy policy | `/privacy` |
| Terms | `/terms` |
| App landing | `/app` |
| Public AI Chat | Floating widget on every public page (rule-based assistant; no provider key) |

### Customer account (logged in as `customer@example.com` at http://localhost:3002)

| Surface | Path |
| --- | --- |
| Account hub | `/account` |
| Profile | `/account/profile` |
| Favorites | `/account/favorites` |
| My visit requests | `/account/visits` |
| My requests | `/account/requests` |
| My property | `/account/property` |
| Contracts | `/account/contracts` |
| Deposits | `/account/deposits` |
| Maintenance — list | `/account/maintenance` |
| Maintenance — new request | `/account/maintenance/new` |
| Maintenance — detail | `/account/maintenance/{id}` |
| Notifications | `/account/notifications` |
| Chat | **Not on web** — chat is the Customer App's in-app assistant. Web has the public-page guest chat widget only. |

### Sales Staff App (logged in as `sales@example.com`, app: `mobile_staff`)

| Surface | Screen |
| --- | --- |
| Login | Auth screen on launch |
| Dashboard | `features/dashboard` shell home |
| Leads | `features/leads` |
| Clients | `features/clients` |
| Visits | `features/visits` |
| Reservations | `features/reservations` |
| Installment Calculator | `features/installments` (calculator + plan view) |
| Bonus | `features/bonus` |
| Targets / Performance | `features/performance` |
| Catalog (browse) | `features/catalog` |
| Profile | `features/profile` |

### Broker Staff App (logged in as `broker1@example.com`, app: `mobile_staff`)

| Surface | Screen |
| --- | --- |
| Login | Auth screen on launch — role redirects to Broker shell |
| Broker dashboard | `features/broker/dashboard` |
| Projects / units (broker-scoped catalog) | `features/broker/catalog` |
| Broker leads | `features/broker/leads` |
| Broker reservations | `features/broker/reservations` |
| Commissions (gated by `canViewCommissions`) | `features/broker/commissions` |
| Profile | `features/broker/profile` |

### Customer App (logged in as `customer@example.com`, app: `mobile_customer`)

| Surface | Screen |
| --- | --- |
| Catalog (guest + authed) | `features/catalog` |
| Auth | `features/auth` (email login + phone OTP) |
| Account hub | `features/account` |
| Favorites | `features/favorites` |
| Visits | `features/visits` |
| Notifications | `features/notifications` |
| My Property | `features/my_property` |
| Deposits | `features/deposits` |
| Contracts | `features/contracts` |
| Maintenance | `features/maintenance` |
| Documents | `features/documents` |
| Chat (AI assistant) | `features/chat` |
| Profile | `features/profile` |

---

## 5. Manual QA test order

Run sections in this order. Each block lists the user to be logged in
as. Cross-reference with [manual-qa-checklists.md](manual-qa-checklists.md)
for the field-level verifications.

### A. Smoke test (5 min)

1. `curl http://localhost:4000/health` returns `{"status":"ok","db":true,...}`.
2. http://localhost:4000/docs renders the Swagger UI.
3. http://localhost:3001 redirects unauthenticated users to `/login`.
4. http://localhost:3002 home page renders 4 seeded projects in the carousel.
5. Both Flutter apps launch on the simulator without a red screen.

### B. Auth and role access

Log in as each user from the table in §3 and confirm they land on the
correct surface and **cannot** reach forbidden surfaces (§6 for the
explicit allow/deny matrix). Verify session restore (refresh the browser
tab / kill+relaunch the mobile app).

### C. Catalog sync (anonymous browse)

As guest on web-public and Customer App:
- Projects list matches between web (`/projects`) and Customer App home.
- Project detail loads images, services, units preview, "Request visit" CTA.
- Unit detail shows price, status, gallery, "Add to compare".

### D. Lead journey

As `sales@example.com` on Admin Dashboard:
- Create a lead from `/dashboard/leads/new`.
- Add a note, assign it, advance the stage.
- Confirm the lead appears in `/dashboard/leads`.

### E. Visit journey

As guest on web-public: request a visit from a unit detail (will prompt
login → use `client@example.com`).
As `sales@example.com`: approve / schedule the request via
`/dashboard/visits/requests`, then confirm and complete the resulting
appointment via `/dashboard/visits/appointments`.

### F. Reservation journey

As `sales@example.com`: create a reservation from a seeded available
unit (`/dashboard/reservations/new`). As `admin@example.com`: approve
the reservation and confirm the booking payment, then convert it to a
contract.

### G. Customer financial / documents

As `customer@example.com` on web-public:
- `/account/contracts` lists the seeded contract.
- `/account/deposits` shows the 200,000 DOWN_PAYMENT row.
- Tap the contract → download the signed `customer1-contract.pdf` URL.
- Switch to `customer2@example.com` → confirm customer1's contract/doc
  are **not** visible (cross-account negative).

### H. Maintenance with photos

As `customer@example.com` on web-public or Customer App:
- `/account/maintenance` shows the seeded "leaky faucet" request.
- Open the request → the seeded photo opens via the signed download URL.
- Create a new request from `/account/maintenance/new`, attach a photo.
As `maintenance@example.com` on the Staff App:
- The new request appears in the supervisor queue (after admin assigns it).
- Transition ASSIGNED → IN_PROGRESS → RESOLVED.

### I. Broker journey

As `broker1@example.com` on `/portal`:
- See only projects p1 + p2.
- Submit a new broker lead.
- Create a broker reservation from the seeded APPROVED lead + plan on p1.
- View commissions (gated by `canViewCommissions=true`).
As `broker2@example.com`: confirm only p3 is visible — broker1's leads/
reservations must **not** appear.
As `admin@example.com`: review submitted broker leads at
`/dashboard/broker-leads`, approve/reject, manage commission lifecycle
at `/dashboard/broker-commissions` and payouts at
`/dashboard/broker-payouts`.

### J. Security checks

Spot-check the forbidden links from §6 below for each role. Log out and
attempt to reach an authed URL directly — must redirect to `/login`
preserving the `from=` query.

### K. Arabic / English + RTL / LTR

Switch the language toggle on:
- web-public footer (Arabic ⇄ English).
- web-admin header (Arabic-only by current product decision — confirm).
- Both mobile apps (translate icon in the app bar).
Verify the layout flips (RTL ⇄ LTR), text fonts swap appropriately
(Inter / IBM Plex Sans Arabic / Tajawal), and selection persists across
reload.

### L. Light / Dark

Toggle the brightness icon on each surface; confirm both themes render
and the choice persists.

### M. Logout / session restore

- Log out from each surface — must redirect to `/login` and clear
  cookies / secure storage.
- Re-open the app/tab after logout — must stay on `/login`.
- After login, refresh the page / relaunch the app — must stay
  authenticated until the access token would naturally expire (15 m
  default — `/auth/refresh` should silently rotate it).

---

## 6. What should pass / what should fail (per role)

> Forbidden URLs in this section produce a redirect (web) or a routed
> bounce (mobile guard) — never a stack trace. Forbidden API calls
> return `403 Forbidden` (role gate) or `404 Not Found` (ownership
> guard — intentional, no existence leak per `OwnershipService`).

### ADMIN

- ✅ Every `/dashboard/**` route, every admin action, every report.
- 🔁 `/portal/**` → redirect to `/dashboard` (broker-only workspace).
- 🚫 No customer-side surfaces (`/account/**` is web-public, not web-admin).
- ⚠️ Expected error message on a forbidden call: 403 + a localized
  toast ("You do not have permission to perform this action" / Arabic
  equivalent).

### SALES / SALES_MANAGER

- ✅ `/dashboard`, `/dashboard/leads/**`, `/dashboard/visits/**`,
  `/dashboard/reservations/**` (read + create + update), read-only:
  `/dashboard/contracts`, `/dashboard/deposits`, `/dashboard/units`,
  `/dashboard/projects`, `/dashboard/installments`, `/dashboard/my-compensation`.
- 🚫 Strict admin actions (`/dashboard/permissions`, `/dashboard/settings`,
  `/dashboard/users` writes, contract sign, deposit verify, broker
  approve/reject, broker commission approve, broker payout flows,
  reports financial mutations, project publish/delete, unit
  create/update/delete/status-change).
- 🔁 `/portal/**` → redirect to `/dashboard`.
- ⚠️ Forbidden direct URL: hits 403 server-side → localized toast.
  Side nav simply does not render forbidden items.

### BROKER (broker1, broker2)

- ✅ `/portal`, `/portal/projects` (scoped to BrokerProjectAccess grants
  only), `/portal/units`, `/portal/leads/**`, `/portal/reservations/**`,
  `/portal/contracts`, `/portal/commissions` (if `canViewCommissions=true`),
  `/portal/payouts`, `/portal/performance`, `/portal/activity`,
  `/portal/notifications`, `/portal/profile`, `/portal/team`.
- 🚫 `/dashboard/**` — login redirects to `/portal`; direct URL bounces
  back to `/portal`.
- 🚫 Cross-broker data: broker2 must not see any broker1 row anywhere.
- ⚠️ Out-of-scope project access at the API: 404 (ownership guard
  intentionally hides existence).

### CLIENT / CUSTOMER (client, customer, customer2)

- ✅ `/account/**` on http://localhost:3002, all in-app Customer App
  features (favorites, visits, my property, deposits, contracts,
  maintenance, documents, notifications, chat, profile).
- 🚫 `/dashboard/**` and `/portal/**` on http://localhost:3001 — the
  admin login form rejects non-staff roles entirely.
- 🚫 Cross-account ownership: customer1 cannot read/download
  customer2's contract / deposit / maintenance / notification, and
  vice versa. Server returns 404 (deliberate, no leak).
- ⚠️ Attempting to mark another user's notification read: 404 + a
  silent failure on the client.

### MAINTENANCE_SUPERVISOR

- ✅ Customer App / Staff App "Maintenance" shell only. Read assigned
  requests; transition ASSIGNED → IN_PROGRESS → RESOLVED; upload photos
  via the scoped `/me/*` endpoints.
- 🔁 Admin login bounces them to `/maintenance-app` info page (read-only
  message + sign-out button).
- 🚫 No admin or financial routes. No documents controller — uploads go
  through `/me` scoped routes only.

### Anonymous (no login)

- ✅ Entire public website except `/account/**`.
- 🔁 Any `/account/**` URL → `/login?from=/account/...`.
- 🚫 Any admin route → `/login` on the admin app.

---

## 7. Known limitations (blocked by external dependencies)

These items are intentionally not fully testable in a pure local/E2E
environment. Track them under "Known limitations" on every release
ticket so QA does not flag them as bugs.

| Item | Status | Why |
| --- | --- | --- |
| **FCM push notifications** | Scaffolded only | `FirebaseService` is a safe no-op without real `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`. Mobile device registration runs through a `NoopPushTokenProvider`. Real delivery needs native Firebase config + a real provider impl. See `docs/mobile-backend-readiness.md`. |
| **OTP via SMS** | Console provider in dev | `OTP_PROVIDER=console` logs the code to the API console. Production requires `OTP_PROVIDER=twilio` + valid `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM`. |
| **Cloudflare R2 file storage** | Local MinIO substitute available | `R2_*` vars empty in `.env.example`. Locally, set `S3_ENDPOINT=http://localhost:9000` + the MinIO defaults from [docs/local-minio-storage.md](local-minio-storage.md) and the same code path serves uploads. Production R2 needs the five real `R2_*` keys. |
| **Email / SMTP** | Not exercised locally | `SMTP_*` empty by default. Production requires Resend or equivalent. |
| **Staging API URL** | Placeholder | `EnvConfig.staging` in [apps/mobile/packages/core/lib/src/env/env_config.dart:47](../apps/mobile/packages/core/lib/src/env/env_config.dart#L47) is `https://staging-api.example.com/v1`. No real staging environment is wired yet. Override at runtime via `--dart-define=API_BASE_URL=...`. |
| **App Store / Play Store URLs** | Unset | `NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_GOOGLE_PLAY_URL` empty → web-public shows "قريباً" placeholders, not real links. |
| **Mobile app IDs / icons / signing** | Not configured | Native flavors (separate bundle IDs / signing / app icons per environment) are deferred. Today flavors are entrypoint + `--dart-define` only. See `docs/mobile-store-readiness.md` for the full pre-release punch list. |
| **Mobile integration tests** | Need a real emulator/device | The widget + cubit test suite (231 tests) runs headless via `flutter test`. Full integration tests require a connected device/emulator. |
| **Map embeds** | External link fallback when no API key | Both web-admin (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) and the mobile apps fall back to "open in Google Maps" external links until a key is provided. |
| **Sentry** | Disabled when DSN unset | `SENTRY_DSN` empty → SDK is not loaded; app boots normally. Fully supported in this state. |
| **Production secrets** | Not stored anywhere in this repo | Never paste production tokens into seed scripts, env examples, or this doc. |

---

## Appendix — Document scope reminder

This sheet covers **local, E2E, and staging** access only. Every URL is
either `localhost:*` or an explicit `staging-*` placeholder. Every
credential is mirrored from `apps/api/prisma/SEED_USERS.md`. No
production secrets, no real Firebase / Twilio / R2 tokens, no real
JWT secrets, no real keystores, no real signing identities appear in
this document or in any file it references.
