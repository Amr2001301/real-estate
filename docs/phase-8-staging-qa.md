# Phase 8 — Staging Release Candidate + Real-Device QA

This is the master Phase 8 doc: every checklist you need to run a
staging release candidate against real services and real devices,
plus the explicit input table for what's still blocked on
external assets/credentials.

Companion to:
- [`docs/system-qa-strategy.md`](system-qa-strategy.md) — automated QA strategy (Phases 7A–7F)
- [`docs/mobile-release-guide.md`](mobile-release-guide.md) — daily run + release build commands
- [`docs/mobile-store-readiness.md`](mobile-store-readiness.md) — Play / TestFlight upload checklists
- [`docs/manual-qa-checklists.md`](manual-qa-checklists.md) — per-platform manual QA blocks

**Phase 8 ships no product code changes.** Until the §C input checklist
turns from "Needs decision/asset/credentials" to "Provided", Phase 8 is
a docs phase only.

---

## A. Implementation status

| Layer | Local (CI-verified) | Staging | Production |
| --- | --- | --- | --- |
| Backend tests (unit + e2e) | ✅ 984 + 115 in CI | ⏸ awaits staging URL | ⏸ |
| Web admin Playwright | ✅ in CI | ⏸ awaits staging deploy | ⏸ |
| Web public Playwright | ✅ in CI | ⏸ awaits staging deploy | ⏸ |
| Mobile static + unit/widget | ✅ 231 in CI | n/a | n/a |
| Mobile `integration_test` on a real device | ⏸ (no device) | ⏸ | ⏸ |
| Push notification real-device test | ⏸ awaits Firebase creds | ⏸ | ⏸ |
| OTP login real-SIM test | ⏸ awaits Twilio production | ⏸ | ⏸ |
| `release-verify.sh` (8 gates) | ✅ 8/8 with services up | (re-run against staging) | ⏸ |

---

## B. Phase 8 execution checklists

Run §B.1 through §B.5 in order. Mobile checklists §B.4/§B.5 are
**device-class** (Android + iOS) — every entry runs once per
device class.

### B.1 Admin Dashboard

Run against the staging Admin URL after login as the seeded staging
admin user (see §C row 18). One pass per role: ADMIN, SALES_MANAGER,
SALES, BROKER.

- [ ] `/login` form accepts email + password; wrong password shows a
      localized error.
- [ ] After login the URL leaves `/login` (admin → `/dashboard`,
      broker → `/portal`).
- [ ] Side nav renders the role-appropriate set:
      - ADMIN: Dashboard, Leads, Projects, Units, Customers, Inventory,
        Reports, Brokers, Bonus, Settings.
      - SALES: NOT visible: Reports, Brokers, Bonus, Settings.
      - SALES_MANAGER: SALES set + Reports.
- [ ] `/dashboard` renders KPI tiles without a 5xx / overlay.
- [ ] Direct nav to a forbidden route bounces or 403s:
      - SALES → `/dashboard/bonus`: bounce/403.
      - SALES → `/dashboard/settings`: bounce/403.
      - BROKER → `/dashboard`: bounce.
- [ ] CSV export downloads from `/dashboard/reports` open a real file.
- [ ] `/dashboard/projects` and `/dashboard/units` lists paginate.
- [ ] Lead create → stage advance → add-note round-trip works.
- [ ] Reservation list visible; admin approve/reject/cancel work on a
      PENDING reservation; unit lifecycle observed:
      AVAILABLE → RESERVED (sales-create) → AVAILABLE (reject/cancel)
      OR → SOLD (convert with booking payment confirmed).
- [ ] Maintenance request list is visible; assignment + status update
      round-trip works.
- [ ] No raw 5xx / Nest exception trace ever appears in the UI.

### B.2 Public Website

Arabic + RTL throughout (the public site is Arabic-only by design).

- [ ] `/` renders the hero, search panel, and featured-projects strip.
- [ ] `/projects` lists projects with search/filter/sort.
- [ ] `/projects/:id` renders gallery, amenities, map, units preview.
- [ ] `/units` lists units; filters (status, rooms, price) work.
- [ ] `/units/:id` opens full detail; "Add to compare" toggles.
- [ ] `/compare` shows selected units side-by-side.
- [ ] `/contact` form submits successfully (success card appears).
- [ ] `/register` creates a customer account; redirects to `/account`.
- [ ] `/login` accepts the customer's credentials.
- [ ] Logged-in customer can reach `/account/profile`,
      `/account/favorites`, `/account/visits`, `/account/requests`.
- [ ] Staff role attempt to reach `/account/*` → bounced.
- [ ] Logout clears session; revisit to `/account/...` bounces to
      `/login?from=…`.

### B.3 Customer mobile — Sales + Broker negative checks

Run on a real Android device + a real iOS device (real customer flows
land in §B.4). For each device class assert:

- [ ] **Broker workspace** is NOT reachable from Customer App
      navigation.
- [ ] **Sales workspace** is NOT reachable from Customer App
      navigation.
- [ ] Customer cannot see Sales-only or Broker-only content surfaces.

### B.4 Customer App — Android + iOS

Install the **staging** customer APK / TestFlight build (commands in
§D). Run with Arabic UI **and** English UI. Run with light theme
**and** dark theme.

- [ ] Cold start ≤ 3s on mid-range device (Pixel 5 / iPhone 12).
- [ ] Splash → Login appears with no flash of unstyled content.
- [ ] **Auth** — phone-OTP login round-trip with a real Twilio SMS
      (or the staging OTP test number).
- [ ] After login, language switch in Profile rebuilds the app in the
      new locale without re-login; RTL/LTR flips chip alignment, padding,
      icons.
- [ ] Theme switch in Profile applies system-wide.
- [ ] **Browse** projects → unit detail. Images load via signed URLs
      (R2). Skeletonizer covers the loading state (no shimmer if
      "Reduce Motion" is on at the OS level).
- [ ] **Favorites**: tap heart, kill app, reopen → still favorited.
- [ ] **Visit request** from a unit. Confirmation toast localized.
- [ ] **My Property** screen lists the contract; **Contracts** screen
      lists the same contract; on tap, the contract PDF opens via a
      **signed URL only** (no permanent R2 URL visible in `flutter
      logs` — see §B.6 spot-checks).
- [ ] **Deposits** screen lists deposits with localized currency.
- [ ] **Maintenance**: create request with 2 photos (camera + gallery
      mix on a device with iOS localized photo prompt installed —
      §C row 9). Verify backend that documents are registered and
      `fileUrl` is the R2 key, not a signed URL.
- [ ] **Notifications**: list + mark read + mark-all-read; badge updates
      live; an admin-triggered notification arrives via FCM
      (§C row 6 must be provided).
- [ ] **401 → silent refresh**: leave the app idle past the access-token
      TTL (15 min) then perform any authenticated action; the request
      retries transparently.
- [ ] **Logout** returns to login; secure-storage cleared (next launch is
      Guest).

### B.5 Staff App — Sales + Broker (Android + iOS)

Install the **staging** staff APK / TestFlight build. Run with Arabic.

#### Sales role

- [ ] Login as `sales-staging@<your-domain>` lands on Dashboard.
- [ ] Dashboard shows bonus + target tiles (or graceful empty if no
      bonus row yet — never a stack trace).
- [ ] Leads → create lead → call / WhatsApp / email actions launch
      external intents; a missing handler falls back to a localized
      snackbar.
- [ ] Clients list paginates; pull-to-refresh works.
- [ ] Visits → create visit → confirm → complete (state machine).
- [ ] Reservations → create reservation (no admin approval step
      visible to Sales).
- [ ] Installment Calculator: change price, plan, down payment;
      values update synchronously.
- [ ] Sales Profile shows performance summary.
- [ ] All screens RTL when Arabic.

#### Broker role

- [ ] Login as `broker-staging@<your-domain>` redirects to
      `/broker/home` (cannot reach `/sales/*`).
- [ ] Broker Dashboard shows KPIs + recent leads/reservations.
- [ ] Broker Commissions tile **hidden** if `canViewCommissions=false`;
      if visible, opens the commissions screen.
- [ ] Broker Projects lists only granted projects.
- [ ] Broker Leads → create lead.
- [ ] Broker Reservations → create reservation (lead required).
- [ ] If `/portal/commissions` 403s, the screen shows the localized
      forbidden state (not a raw error).

### B.6 Cross-cutting / privacy spot-checks (every release)

- [ ] **No permanent R2 URL** in any customer-facing API response
      (sample three: `/v1/contracts/me/contracts`, `/v1/me/deposits`,
      `/v1/me/maintenance-requests/:id`).
- [ ] **No signed URL in the rendered DOM** on the customer portal
      (run `document.body.innerText` after visiting `/account/contracts`;
      grep should miss any URL containing `X-Amz-Signature`).
- [ ] **No bearer token in mobile logs** during a full login → browse →
      download cycle (release builds strip `debugPrint`; the
      `LogInterceptor` is `kDebugMode`-gated regardless).
- [ ] **No OTP code in API logs** when `OTP_PROVIDER=twilio` (only the
      `console` provider echoes).
- [ ] Backgrounding the app and returning preserves navigation stack;
      no forced re-login while the access token is valid.
- [ ] Network drop → request shows a localized "you're offline"
      failure, not a Dio stack trace.

---

## C. Required external inputs (BLOCKING)

Until each row turns from "Needs …" to "Provided", Phase 8 cannot
move past the doc-only state. Run `release-verify.sh` locally any
time to confirm the existing automated gates still pass; that is
unblocked.

| # | Item | Current state | What we need | Why it's blocked |
| --- | --- | --- | --- | --- |
| 1 | **Staging API URL** | `EnvConfig.staging.apiBaseUrl = 'https://staging-api.example.com/v1'` (placeholder) | One real URL ending in `/v1` (e.g. `https://staging-api.<your-domain>.com/v1`) | Mobile + web cannot point at staging until this is set; `--dart-define=API_BASE_URL=…` can be used per-run, but production builds need it baked into the file |
| 2 | **Production API URL** | `EnvConfig.prod.apiBaseUrl = 'https://api.example.com/v1'` (placeholder) | One real URL | Required before tagging a prod build |
| 3 | **Customer Android `applicationId`** | `com.realestate.customer.mobile_customer` (placeholder) | Final reverse-domain (e.g. `com.<brand>.customer`) — **immutable after first Play upload** | Phase 6 documented this; gate before first upload |
| 4 | **Customer iOS bundle ID** | `com.realestate.customer.mobileCustomer` (placeholder) | Final reverse-domain — immutable after first TestFlight upload | Same |
| 5 | **Staff Android `applicationId`** + iOS bundle ID | `com.realestate.staff.mobile_staff` + `com.realestate.staff.mobileStaff` (placeholders) | Final reverse-domains | Same |
| 6 | **Firebase project + 4 config files** | 4 `.example` placeholders shipped in repo (Phase 6) | A real Firebase project + `google-services.json` per Android app + `GoogleService-Info.plist` per iOS app | Drop at the canonical paths the `.example` files document; never paste real values in chat |
| 7 | **APNs `.p8` key** | Not present | Upload to Firebase Console → Cloud Messaging → Apple app config | Required for iOS push |
| 8 | **Twilio production credentials** | Local backend `.env` has Twilio dev sandbox; staging API will need its own values | Staging + prod backend env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | OTP login on the staging build won't work without it |
| 9 | **One-time iOS Xcode localization step** | `en.lproj/` + `ar.lproj/` present on Customer Runner; not added to Xcode project's Localizations array | Open `mobile_customer/ios/Runner.xcworkspace` → Project ▸ Info ▸ Localizations → add `English` + `Arabic` | Without this, iOS camera/photo permission prompts fall back to English on the device |
| 10 | **Android upload keystores** | `.gitignore`d paths wired in `key.properties.example` | One keystore + `key.properties` per app, dropped at the documented paths | Required for signed AAB upload to Play |
| 11 | **iOS Distribution cert + provisioning profile** | Not present | Apple Developer Program account + Xcode-managed signing | Required for TestFlight |
| 12 | **Display names** ar + en | Android: `mobile_customer` / `mobile_staff`; iOS: `Mobile Customer` / `Mobile Staff` (placeholders) | Final user-facing names per app per locale | Visible on home screen, store listings |
| 13 | **Launcher icons** | Default Flutter icon (md5 verified identical on both apps) | 1024×1024 PNG per app + Android adaptive-icon foreground + background hex | Replace via `flutter_launcher_icons` (dev_dep not yet added — waits for asset) |
| 14 | **Splash assets** | Default Flutter white splash | Transparent splash logo per app + brand-color hex | Replace via `flutter_native_splash` |
| 15 | **WhatsApp + contact phone (per env)** | Empty strings in all three `EnvConfig` presets | Real numbers for staging + prod | Empty strings hide the WhatsApp / Call CTAs entirely |
| 16 | **R2 bucket for staging** | Local backend `.env` has R2 dev creds | Staging backend env: `R2_*` set against a separate staging bucket | Document upload / signed download won't work without it |
| 17 | **Staging Postgres + Redis** | Not stood up | Provisioned + reachable from the staging API host | Required to run the staging API |
| 18 | **Staging test accounts** | Local seed (`apps/api/prisma/SEED_USERS.md`) is LOCAL ONLY | One Admin, one Sales, one SalesManager, one Broker, one Client, one Customer — seeded against the staging DB with documented passwords stored OUTSIDE the repo (1Password / secret manager) | The seeded local users have public passwords; they would be a real-world security hole if reused |
| 19 | **An Android phone + an iOS phone** for QA | Not connected to this workstation | Physical devices (or Genymotion / iOS simulator on a dev machine) | The mobile QA in §B.4/§B.5 cannot run without them |
| 20 | **Privacy policy URL + support email** | Not present | Hosted privacy policy + support@<domain> | Required for Play + App Store listings |
| 21 | **Store-listing copy + screenshots ar + en** | Not present | Title (30 char), short description (80 char), long description (4000 char), keywords, screenshots — per app per locale | Cannot submit to either store without |

For the full Play / TestFlight per-row matrix see
[`mobile-store-readiness.md`](mobile-store-readiness.md) §1–§5.

---

## D. Release candidate build commands

### D.1 Mobile

Run with the staging API once §C row 1 is provided. The
`--dart-define=API_BASE_URL=…` override applies even when
`EnvConfig.staging` still has its placeholder — production builds
should bake the URL into the file before tagging.

```bash
# Customer Android — staging AAB (release)
cd apps/mobile/mobile_customer
flutter build appbundle --release -t lib/main_staging.dart \
  --dart-define=API_BASE_URL=https://staging-api.<your-domain>.com/v1
# Output: build/app/outputs/bundle/release/app-release.aab
# Verify the AAB is signed with the upload key (not debug):
keytool -printcert -jarfile build/app/outputs/bundle/release/app-release.aab

# Staff Android — staging AAB
cd ../mobile_staff
flutter build appbundle --release -t lib/main_staging.dart \
  --dart-define=API_BASE_URL=https://staging-api.<your-domain>.com/v1

# Customer iOS — staging archive
cd ../mobile_customer
flutter build ios --release -t lib/main_staging.dart \
  --dart-define=API_BASE_URL=https://staging-api.<your-domain>.com/v1
# Then: open ios/Runner.xcworkspace → Product → Archive → Distribute
# Distribute → App Store Connect → Upload (for TestFlight)

# Staff iOS — staging archive
cd ../mobile_staff
flutter build ios --release -t lib/main_staging.dart \
  --dart-define=API_BASE_URL=https://staging-api.<your-domain>.com/v1
```

**Smoke build** (no staging URL needed — works today against any
reachable API):

```bash
cd apps/mobile/mobile_customer && flutter build apk --debug -t lib/main_dev.dart
cd ../mobile_staff             && flutter build apk --debug -t lib/main_dev.dart
# Output: build/app/outputs/flutter-apk/app-debug.apk per app
```

**iOS smoke (no codesigning required)** — also works today:

```bash
cd apps/mobile/mobile_customer && flutter build ios --release -t lib/main_dev.dart --no-codesign
cd ../mobile_staff             && flutter build ios --release -t lib/main_dev.dart --no-codesign
```

### D.2 Web

```bash
# Both Next.js apps build identically (existing build commands).
pnpm --filter @rep/web-public build   # → .next/ ready for `next start`
pnpm --filter @rep/web-admin  build

# Deploy artefacts (host of your choice — Vercel, Cloudflare Pages, Docker).
# Both apps need API_BASE_URL set in their hosting environment, NOT inlined
# into the static build (Next.js reads it at request time via the rewrite
# in next.config.ts → /api-proxy/* → ${API_BASE_URL}/v1/*).
```

### D.3 Backend

```bash
# Local-prod-shape build (validates the dist/ output):
pnpm --filter @rep/api build
# Output: apps/api/dist/main.js — start with `node dist/main.js`.

# Required prod env (all secrets — drop into the deploy host's secret store):
#   DATABASE_URL                         (staging Postgres)
#   REDIS_URL                            (staging Redis)
#   JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (≥16 char random)
#   TWILIO_*                             (production Twilio)
#   FIREBASE_*                           (firebase-admin service account JSON parts)
#   R2_*                                 (staging R2 bucket)
#   OTP_PROVIDER=twilio                  (default `console` for dev)
#   NODE_ENV=production
#   API_BASE_URL=https://staging-api.<your-domain>.com
#   CORS_ORIGINS=https://admin.<your-domain>.com,https://www.<your-domain>.com
```

### D.4 Local release verification (one-shot, unblocked today)

```bash
bash scripts/release-verify.sh
# 6/8 gates pass with no DB or services: backend unit, mobile analyze + test,
# zero-Riverpod, Clean Architecture boundaries, no-secrets, plus an SKIP
# message on the 2 Playwright sections explaining how to enable them.

# With Postgres + API + both web apps + TEST_DATABASE_URL set:
bash scripts/release-verify.sh     # all 8/8 (verified live in Phase 7F)
```

---

## E. What can be done immediately (no external inputs required)

1. **Run `release-verify.sh` quick mode** — the 6 runnable gates pass
   today (verified ahead of writing this doc).
2. **Build dev debug APKs** for both apps — proves the build path is
   intact end-to-end (the Phase 6 + Phase 7E builds were also clean).
3. **Build iOS no-codesign release** for both apps — same, no signing
   needed.
4. **Run the backend test:e2e suite** locally against a fresh
   `realestate_e2e` Postgres DB — 115 tests across 11 spec files.
5. **Run the full Playwright suite locally** when all 3 services are
   pointed at the local e2e DB — 12 admin + 13 public passing in §0.6
   / §0.7 of `system-qa-strategy.md`.

What we **cannot** do until §C rows turn green:

- Build a staging AAB / TestFlight archive with the real staging URL
- Sign + upload to Play Internal / TestFlight
- Run the real-device QA in §B.4 / §B.5 (no devices on this
  workstation, no staging API to point at, no real Twilio SMS, no real
  FCM project)
- Claim production readiness — Phase 6 documented "never claim push
  works without an observed real-device delivery"; that remains the
  hard gate before tagging prod.

---

## F. Final recommendation before store upload

In order (must be done sequentially — each row blocks the next):

1. **Provide §C row 1 and §C row 2** — the real staging + prod API
   URLs. Optionally bake them into `EnvConfig.staging.apiBaseUrl` and
   `EnvConfig.prod.apiBaseUrl` so they're checked into the repo. Until
   then, all staging builds must pass `--dart-define=API_BASE_URL=…`
   explicitly.
2. **Provide §C row 17** — staging Postgres + Redis stood up, and
   §C row 16 / row 8 — staging R2 bucket + staging Twilio. Then
   deploy the staging API (D.3).
3. **Provide §C row 18** — staging test-account credentials (stored
   in a secret manager, *not* in the repo).
4. **Re-run `release-verify.sh`** with `E2E_BASE_URL` pointed at the
   staging hosts to confirm the existing suites work against the
   real backend.
5. **Provide §C row 3–5 + 12–14** — final reverse-domain
   applicationIds, display names, icons, splash. These bake into the
   built artefacts and must be set before the first store upload.
6. **Provide §C row 6 + 7** — Firebase project + 4 config files +
   APNs `.p8`. Then re-build the staging artefacts and **verify
   push delivery on one real iOS + one real Android device** (§B.4
   "Notifications" row).
7. **Provide §C row 10 + 11** — Android upload keystore + iOS
   Distribution cert + provisioning profile. Then build the signed
   AAB + the signed iOS archive, and upload to Play Internal +
   TestFlight (§B.4–§B.6 run against the uploaded builds, not local
   ones).
8. **Run the device QA blocks** §B.4 (Customer App) and §B.5 (Staff
   App) on one real Android phone + one real iPhone, ar + en, light +
   dark, on the staging build.
9. **Run §B.6 privacy spot-checks** against the staging build.
10. **Promote** to Play Closed Testing → Open Testing → Production
    once §C row 20 + row 21 (privacy policy URL + listing copy +
    screenshots) are filled.

**Only after step 10's QA sign-off should anyone tag a production
release.** The platform's automated gates are all green
(`release-verify.sh` 8/8 with services up), but they cover what
can be tested without physical devices or production credentials —
they do not, and cannot, certify push delivery, OTP via real SMS,
launcher-icon rendering, signed-build runtime, store-listing
correctness, or cross-device install flow. Those are §B's job.
