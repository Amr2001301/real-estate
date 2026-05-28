# Mobile Backend Readiness (parallel track)

Findings from inspecting `apps/api` for the three mobile-blocking concerns, plus the
exact backend tasks required. **None of these block the Phase 1 UI foundation** — they
gate later mobile phases (notifications, typed client, customer financial data).

Status legend: ✅ ready · 🟡 partial · ❌ missing

---

## Phase 3B outcome (2026-05-27) — what changed

| Area | Before | After | Production-ready? |
|---|---|---|---|
| FCM push | ❌ not wired | ✅ `FirebaseService` (safe no-op when creds absent) + `PushService` (multicast + prunes dead tokens) wired into `NotificationsService.send`; mobile push **scaffolded** behind `PushTokenProvider` (no-op) | **Needs creds + device test** — Firebase service account (`FIREBASE_*`) **and** mobile native config (`google-services.json`/`GoogleService-Info.plist`) + a real-device delivery test. Code path verified by unit tests. |
| Notifications API | 🟡 raw rows | ✅ localized `title`/`body` resolved from template+payload (ar/en, `{{var}}` interpolation); **unread-count** endpoint; **pagination**; mobile uses resolved text + unread badge | ✅ ready |
| Ownership | 🟡 inline | ✅ centralized `OwnershipService` (`common/ownership`) with `assert*` throwing `NotFound` (no existence leak) + cross-account specs; used by signed downloads | ✅ ready (extend to contracts/deposits detail routes in 3C) |
| Signed downloads | ❌ public URLs | ✅ `r2.createPresignedDownload` (GetObject, 5-min expiry, safe filename + content type) + `GET /me/documents/:id/download` (ownership + `CUSTOMER_VISIBLE` checked at access time, JSON `{url,fileName,contentType,expiresIn}`) | ✅ ready when R2 creds present (same creds as uploads). |
| OTP/SMS | 🟢 mostly | ✅ OTP code **never logged in production** (dev-only); cooldown + attempt limits + hashing already present | ✅ ready in dev (console); **prod SMS needs Twilio creds** (`OTP_PROVIDER=twilio`). |
| Favorites | 🟡 no flag | ✅ `GET /me/favorites/ids` → `{projectIds,unitIds}` (guest browsing untouched) | ✅ ready |
| OpenAPI | 🟡 runtime only | ✅ `pnpm --filter api openapi:export` → `openapi.json` (Nest preview mode, no DB) for Dio codegen | ✅ ready (codegen migration deferred; manual DTOs still in use) |

Backend: **984 unit tests pass** (incl. new ownership + push specs). Mobile: analyze clean,
notification UI uses resolved title/body + unread badge, push registration scaffolded
(no fake token). **Deferred to product/credentials:** real FCM delivery, Twilio SMS, and
adding `appVersion`/`deviceId` to `DeviceToken` (additive migration — proposed, not run).

---

---

## 1. OpenAPI export → Dio model generation — 🟡

- Swagger **is** enabled at `/docs` with `addBearerAuth()` (`apps/api/src/main.ts`).
- **No offline export**: no `package.json` script writes `openapi.json`; the spec only
  exists in-memory at runtime.
- **Sparse decorators**: DTOs use class-validator only — almost no `@ApiProperty`, and
  controllers have no `@ApiResponse`/`@ApiOperation`. So the generated spec has weak
  response typing.

**Tasks**
1. Add a script to emit `openapi.json` at build time (bootstrap the Nest app, write
   `SwaggerModule.createDocument(...)` to a file, exit).
2. Enrich high-traffic DTOs/controllers with `@ApiProperty` + `@ApiResponse` (auth,
   public catalog, `/me/*`, chat first — the endpoints mobile hits in early phases).
3. Add a mobile codegen step (e.g. `swagger_parser`/`openapi-generator`) producing
   freezed/json models under `packages/core/lib/src/models/generated/`.
4. Wire a CI check so the committed spec + generated models can't drift.

**Mitigation meanwhile:** hand-write freezed models per feature against the documented
response shapes (the chat contract is already precise).

---

## 2. FCM push delivery — ❌ (P0 for notifications)

- `firebase-admin` is **installed but never initialized** (`env.validation.ts` even
  notes Firebase is intentionally not required yet).
- Notifications module **only persists rows** to the DB (`IN_APP`); there is **no FCM
  send** and **no domain-event triggers** on reservation/contract/visit/maintenance
  status changes.
- `POST /v1/me/devices` stores a token + platform but it's never used for delivery.

**Tasks**
1. Initialize Firebase Admin from env credentials in a dedicated service.
2. `FcmService.send(...)` using `messaging().sendEachForMulticast(...)` over a user's
   device tokens.
3. Emit domain events on status changes → enqueue a BullMQ job → call `FcmService`.
4. Prune invalid/expired tokens on send failure; add a token-verify path.
5. End-to-end test: deliver a push to a real device for each platform.

**Mobile impact:** every "Notifications" screen and push deep-link is blocked until this
lands. The Flutter side (`firebase_messaging` + `flutter_local_notifications`, register
via `POST /me/devices`, deep-link on tap) is a Phase 3 task gated on this.

---

## 3. Ownership guard for customer financial data — 🟡

Per-endpoint ownership is checked **inline** in services (Prisma filters), with **no
centralized guard**. Core `/me/*` reads are safe today; the risks are around
consistency and document downloads.

- `GET /me/contracts`, `GET /me/deposits`, `GET /me/maintenance-requests/:id` correctly
  scope by `customerId == user.sub` (maintenance throws 404 on mismatch).
- ⚠️ `GET /contracts/:id` has **no ownership check** for SALES/ADMIN (role-gated, by
  design, but lateral access is uncontrolled — document it).
- ⚠️ `/me/deposits` has **no explicit `@Roles(CUSTOMER)`** — safe via filter, but intent
  is unclear; add the guard.
- ⚠️ **Document downloads**: files are served from stored public R2/CDN URLs. Visibility
  (`CUSTOMER_VISIBLE`) is enforced at DB-list time, **not at fetch time** — anyone with
  the URL can fetch it. Upload presigns expire in 5 min; there is **no signed download**
  path.

**Tasks (before shipping contracts/deposits to devices — Phase 3)**
1. Add a reusable ownership guard/decorator (e.g. `@OwnsResource('contract','customerId')`).
2. Add `GET /documents/:id/download` that enforces ownership + visibility, then issues a
   short-lived **signed** download URL (no static public URLs for sensitive docs).
3. Add `@Roles(CUSTOMER)` to `/me/deposits`; audit-log sensitive reads.
4. Verify signed-URL expiry on the customer download path.

---

## 4. Public catalog gaps (found building Phase 2 guest browse) — 🟡

The public catalog endpoints (`/public/projects`, `/public/units`, `/public/units/:id`,
`/public/projects/:id`) are sufficient for guest browsing. Minor gaps the mobile app
worked around:

1. **No batch units endpoint** (`GET /public/units?ids=`). Compare operates on
   already-loaded `Unit` objects (the public unit shape is self-contained by design).
   Impact: a saved/deep-linked compare set can't be rehydrated server-side. Low priority.
2. **No `/public/cities`**. City filter chips are derived best-effort from loaded
   projects. A small `GET /public/cities` (distinct, ar+en) would make the city filter
   complete and stable. Medium priority.
3. **No price on projects / no project price filter**. Price filtering exists only on
   units (`priceMin/priceMax`). Project quick-filters are city/featured/sort only.
4. **`services` is free-form** `[{ar,en}]` (no amenities taxonomy) — rendered as chips.
5. **OpenAPI codegen still pending** — Phase 2 ships hand-written DTOs in
   `core/lib/src/catalog/models`. Replace once codegen lands (gap #1 above).

None of these block Phase 2 (public browsing). FCM and the ownership guard are
irrelevant here — no auth, no private data.

## 5. Gaps found building Phase 3A (auth/profile/favorites/visits/notifications) — 🟡

Endpoints exist and are sufficient; minor gaps the app worked around:

1. **Notifications carry no resolved title/body.** `GET /me/notifications` returns
   `templateCode` + `payload` only (text lives in `NotificationTemplate`). Mobile shows a
   client-derived title from `templateCode` (+ `payload.message` if present). **Recommend:**
   resolve the template server-side and return localized `title`/`body` (or add a
   `GET /me/notifications` variant that joins the template). Also no unread-count endpoint
   (derived from the list).
2. **OTP/SMS delivery is stubbed.** `POST /auth/otp/request` returns `{ok:true}` but no SMS
   is sent in non-dev. The flow is fully implemented; **wire an SMS provider** for prod OTP.
3. **FCM push delivery not wired (P0, pre-existing).** `POST /me/devices` exists; the app
   **scaffolds** registration but does not obtain/send a token. Notifications are pull-only.
4. **Favorites delete is by favorite-id**, and the list embeds raw project/unit rows — the
   app maps defensively and keeps an id lookup. No `isFavorited` flag on catalog endpoints
   (cross-referenced from the loaded favorites set). Fine; documented.
5. **Profile** editable fields are `fullName`/`phone`/`locale` only (email immutable) — matches
   `PATCH /users/me`.

These do **not** block Phase 3A. The deferred sensitive screens (My Property, deposits,
contracts PDF, maintenance docs) remain gated on §3 (ownership guard + signed download).

## 6. Phase 3C (My Property / contracts / deposits / maintenance) — built 2026-05-27

The deferred sensitive screens are now implemented in `mobile_customer`, on top of the
ownership guard + signed downloads from Phase 3B.

**Backend change in this phase (small, additive):**
- `OwnershipService.assertOwnsDocumentOwner` → renamed public `assertOwnsOwner(userId, ownerType, ownerId)`.
- `MeDocumentsController` gained `GET /me/documents?ownerType&ownerId` — lists
  **CUSTOMER_VISIBLE** document metadata for an owned contract/deposit/maintenance request
  (ownership-checked, **no `fileUrl`**). Pairs with the existing
  `GET /me/documents/:id/download` signed-link endpoint. tsc clean; ownership + documents
  specs pass (29 tests).

**Endpoints consumed (all pre-existing except the list above):**
- My Property + Contracts ← `GET /me/contracts` (derived; legacy public PDF URLs ignored).
- Deposits ← `GET /me/deposits` (amount/type/verified/paidAt; legacy `receiptUrl` ignored).
- Maintenance ← `GET /maintenance-categories`, `GET /me/maintenance-requests`,
  `POST /me/maintenance-requests` (`unitId` + `categoryIds[]` + `description`).
- Documents (contracts PDFs, deposit receipts, maintenance photos) ← signed list + download
  endpoints only. **No permanent URL is ever shown, logged, or persisted**; a fresh signed
  link is minted just-in-time on every tap (expiry-safe by construction).

**Gaps / decisions:**
1. **No dedicated `GET /me/units` for customers.** `OwnershipService`/`customerUnits` is
   admin-only. The maintenance create form derives the unit picker from `/me/contracts`
   (via the My Property use case). Fine for v1; **recommend** a small customer-units endpoint
   if unit selection grows.
2. **No per-owner counts.** Deposit/contract rows don't expose a document count, so the app
   loads documents on the detail screen rather than showing a badge on the list. Acceptable.
3. **Maintenance photo upload — implemented in Phase 3C.1 (see §7).**
4. **Create response has no includes.** `POST /me/maintenance-requests` returns scalar fields
   only (no `category`/`unit` objects); the mapper tolerates this. The list is re-fetched
   after a successful create rather than optimistically inserted.

No payments UI (none in scope). No Admin mobile. Staff app still compiles with no Staff
features.

## 7. Phase 3C.1 (maintenance photo upload) — built 2026-05-27

Photo attachments for the maintenance create form. **No backend change** — reuses the
existing customer-scoped flow:
`POST /me/maintenance-requests/:id/documents/presign` → PUT to the signed R2 URL →
`POST /me/maintenance-requests/:id/documents` (registers a `CUSTOMER_VISIBLE` doc).

- **Order:** the request is created first (to get its id), then each photo uploads. A retry
  never re-creates the request (guarded by a stored `requestId`).
- **Security:** the signed PUT URL is treated as a secret — never logged. The direct-to-storage
  PUT uses a **separate, interceptor-free Dio** so the app's bearer token is never sent to R2.
  Only the `publicUrl` is registered; downloads still go through the signed download endpoint.
- **Validation (client):** ≤ 5 photos, ≤ 10 MiB each (backend caps 25 MiB), MIME ∈
  {jpeg, png, webp}. Backend re-validates type + size before minting a slot.
- **UX:** thumbnails, per-photo progress/status, remove-before-submit, friendly localized
  validation + failure messages, partial-failure handling with a **Retry failed** / **Done**
  choice, double-submit guard.
- **Architecture:** `MaintenanceRepository.uploadPhoto` owns the 3-step dance (data layer);
  `UploadMaintenancePhoto` use case; the cubit depends on use cases + a `PhotoPicker`
  abstraction (image_picker confined to one presentation impl, faked in tests). Domain stays
  pure (`dart:typed_data` only).

**Native setup required for real devices:**
- **iOS:** `Info.plist` now declares `NSCameraUsageDescription`,
  `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` (friendly English) +
  `CFBundleLocalizations` (en, ar). Localized prompt overrides live in
  `ios/Runner/{en,ar}.lproj/InfoPlist.strings`. **To make the iOS *system* prompts localized,
  those `.lproj/InfoPlist.strings` files must be added to the Runner target in Xcode once**
  (project.pbxproj resource refs) — editing the pbxproj by hand is error-prone, so it's left
  as a one-time Xcode step. The in-app "permission denied" helper is already localized
  regardless. Run `cd ios && pod install` after first pulling the image_picker dep.
- **Android:** no manifest change needed — image_picker uses the system Photo Picker for the
  gallery and a camera intent (no `CAMERA`/storage runtime permission declared). minSdk is the
  Flutter default (21+), which image_picker supports.

**Deferred:** still no customer photo *delete* (only add + view); fine for v1.

## 8. Phase 4A (Staff App foundation + Sales MVP) — built 2026-05-27

First slice of the **Staff App** (`mobile_staff`): authentication, a Sales navigation shell,
and read-only Sales features. **No backend change** — all endpoints already existed.

**Endpoints consumed:** `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` ·
`GET /users/me` · `GET /leads` (stage/q/mine filters) · `GET /leads/pipeline` · `GET /leads/:id`
(notes + activities) · `PATCH /leads/:id/stage` · `POST /leads/:id/notes` · `GET /visits/stats` ·
`GET /reservations/stats` · `GET /projects` + `/projects/:id` · `GET /units?projectId` + `/units/:id`.

**Auth & routing:** staff email/password login (shares core `TokenStorage`/`SessionCubit`/Dio
401→refresh). Role-aware redirect (pure `staffRedirect`, unit-tested): Sales/Sales Manager/Admin →
shell; **BROKER → "coming soon" placeholder** (locked until Phase 5); customer-side roles → login.

**Sharing decision:** **no catalog extraction into `core`.** The Customer catalog uses
`/public/*` with its own DTOs inside `mobile_customer`; Staff needs the *private* `/projects` +
`/units` (different shape). Staff has its own thin read-only `catalog` feature. Only generic,
already-shared pieces are reused from core (`Translatable`, `Paginated`, `PriceFormatter`,
`StateView`/widgets, `Session`/`AppRole`/`TokenStorage`/Dio). Shared additive change: **new l10n
keys only** (safe for both apps).

**API gaps / decisions:**
1. **No sales-facing Clients endpoint** (`GET /users` is ADMIN-only). Clients MVP is **derived
   from the rep's lead book** (`/leads`, deduped by `clientId`); the client timeline links to the
   lead detail (which carries notes/activities). If a first-class clients API lands later, swap
   the `clients` data source.
2. **No single dashboard aggregate** → composed client-side from pipeline + visit + reservation
   stats; visit/reservation calls are **best-effort** (a missing permission falls back to 0
   rather than blanking the screen).
3. **Permission-gated endpoints:** Sales must hold `leads:read`, `visits:read`, etc. (seeded).
   Missing permissions surface as a friendly forbidden state, never a raw error.

**Deferred (per scope):** Broker real features, reservations workflow, installment calculator,
bonus/commission + full targets module, visit scheduling, staff AI assistant, admin mobile,
payments, lead create/assign, staff catalog mutations (read-only in 4A).

**Verification:** analyze clean ×3; **22 core + 89 customer (no regression) + 32 staff** tests
pass; both apps compile; Clean Architecture boundary greps pass; zero Riverpod. No backend
touched → no jest run.

## 9. Phase 4B (Staff Sales workflows) — built 2026-05-28

Visits, reservations, and an installment calculator for the Staff App. **No backend change.**

**Endpoints consumed:**
- Visits (appointments): `GET /visits/appointments` (status/leadId/today filters) · `GET /visits/appointments/:id`
  (+ `visitActivities` timeline) · `POST /visits/appointments` (projectId required) ·
  `POST /visits/appointments/:id/{confirm,complete,cancel,no-show}`.
- Reservations: `GET /reservations` (status filter) · `GET /reservations/:id` (unit→project, lead, client,
  plan, expiresAt, notes, activities) · `POST /reservations` (unitId required) · `POST /reservations/:id/notes`.
- Installments: `GET /installment-plan-templates` (durationOptions used to prefill the calculator).

**Decisions / gaps:**
1. **No server calculator endpoint.** The formula in `duration-calc.ts` is the documented "single
   source of truth"; it's **mirrored in a pure Dart use case** `CalculateInstallment`
   (remaining = price−reservation−downPayment; financed = remaining×(1+inc%); monthly = financed/months;
   total = reservation+downPayment+financed). Plan templates only prefill duration + increase%. **Keep
   the Dart formula in sync** with the backend if it ever changes.
2. **Reservation transitions (approve/reject/cancel/convert) are ADMIN-only `@PermissionsStrict`** →
   **not implemented** (per scope). Sales can create + read + note only; status is read-only/tracked.
   Visit transitions (confirm/complete/cancel/no-show) **are** Sales-permitted and implemented;
   reschedule/assign are ADMIN-only → deferred.
3. Visit/reservation creation needs context (projectId for visit, unitId for reservation). Launched
   **prefilled from Unit detail** (Reserve / Schedule visit / Calculate) and **Lead detail** (Schedule
   visit → leadId); the list-level FABs show project/unit pickers (loaded via the staff catalog use
   cases). Calculator opens from Dashboard quick action + Unit detail (price prefill).

**Navigation UX:** kept **5 bottom tabs**; the **Dashboard is the workflow hub** — KPI cards are
tappable (Today's visits / Reservations → lists) and a **Quick actions** row launches New visit /
New reservation / Calculator. Eight tabs would hurt ergonomics; this stays data-first and matches the
"expose from Dashboard/Lead/Unit detail" option.

**Verification:** analyze clean ×3; **22 core + 89 customer (no regression) + 56 staff** tests pass
(visit/reservation mappers + repo error mapping + cubits; calculator formula/validation/use case/cubit);
both apps compile; boundary greps pass; zero Riverpod. No backend touched → no jest run.

## 10. Phase 4C (Sales bonus, targets, polish) — built 2026-05-28

Bonus/commission, targets/performance, dashboard + profile polish. **No backend change.**

**Endpoints consumed (all SALES self-scoped, read-only):**
- `GET /bonus-entries?status&period` → entries `{amount, period, status(PENDING/APPROVED/PAID), rule.name}`.
- `GET /sales-targets` → target definitions per period (history).
- `GET /sales-targets/performance?period` → single `SalesPerformanceRow` (counts + target/achieved +
  percent) — powers the Targets progress cards, the Dashboard target card, and the Profile section.

**Permission-aware fallback:** the Dashboard bonus + target cards use dedicated summary cubits that
collapse to a soft **"unavailable"** state on *any* failure (incl. 403) so the dashboard never breaks;
the dedicated Bonus/Targets screens show the friendly localized `ErrorState`. The Profile performance
section hides entirely when both summaries are unavailable.

**Decisions / gaps:**
1. **Bonus export / target upsert are ADMIN-only** → not touched. No reservation/admin actions (per scope).
2. **Monthly only** — performance/targets periods are `YYYY-MM`; no quarterly. Target *history* = the
   per-period target definitions (achievement is single-period via the performance endpoint).
3. **Installment calculator (Phase 4B) follow-up:** documented the formula source
   (`apps/api/.../duration-calc.ts`) in `CalculateInstallment` with a `TODO(api-gap)` for a future
   `POST /installment-plan-templates/calculate`; the regression test asserts exact figures so the
   client mirror can't silently drift.

**Polish:** shared `StaffListSkeleton` now drives the loading state on every list (leads, clients,
visits, reservations, projects, bonus) for consistent skeleton loading; consistent cards/chips/empty
states; RTL/dark inherited from the core theme; Skeletonizer respects reduced-motion.

**Verification:** analyze clean ×3; **22 core + 89 customer (no regression) + 73 staff** tests pass
(bonus/target mappers + repo error mapping + cubits + permission-fallback summary cubits + calculator
regression); both apps compile; boundary greps pass; zero Riverpod. No backend touched → no jest run.

## 11. Phase 5 (Broker features inside the Staff App) — built 2026-05-28

The Broker workspace inside `mobile_staff`. **No backend change** — consumes the existing
`/portal/*` API (`@Roles(BROKER)`, `BrokerScopeGuard`).

**Endpoints consumed (all broker-self-scoped):** `GET /portal/me` · `GET /portal/performance`
(dashboard KPIs + recent leads/reservations) · `GET /portal/projects` (access grants) ·
`GET /portal/units?projectId` · `GET/POST /portal/leads` · `GET /portal/leads/:id` ·
`GET/POST /portal/reservations` · `GET /portal/reservations/:id` · `GET /portal/commissions`.

> The `broker-leads` / `broker-reservations` / `broker-commissions` / `broker-payouts` modules
> are **ADMIN/SALES back-office** (managing brokers) — deliberately **not** used by the broker app.

**Routing:** `staffRedirect` now confines BROKER to `/broker/*` (bounced out of Sales screens),
and Sales/Manager/Admin out of `/broker/*` — both directions unit-tested. The Phase-4A
"coming soon" placeholder is replaced by `/broker/home`.

**Navigation UX:** **5-tab bottom nav — Dashboard · Projects · Leads · Reservations · Profile.**
Commissions is **not** a tab: it's reached from a permission-aware Dashboard card + a Profile
entry, both shown only when `me.permissions.canViewCommissions` is true (avoids a 6th tab and
respects the gate).

**Permission risks / gaps:**
1. **Commissions/payouts are gated by `BrokerCommissionsViewerGuard`.** The app reads
   `canViewCommissions` from `/portal/me` to hide the entry; the screen still degrades to a
   friendly localized forbidden state if the endpoint 403s.
2. **No single-project / single-unit portal endpoint** → broker project detail loads units via
   `/portal/units?projectId`; unit detail is rendered from the list row passed in (no fetch).
3. **Admin-only actions deliberately excluded:** broker lead approve/reject, reservation
   admin actions, commission approve, payout approval/processing. Brokers only **read**
   commissions and **create** leads + reservation *requests*.
4. Reservation create needs `leadId` + `unitId`; launched lead-first (from a lead) or via the
   FAB with lead + project→unit pickers (broker catalog use cases).

**Verification:** analyze clean ×3; **22 core + 89 customer (no regression) + 112 staff (Sales
no regression)** tests pass — broker routing, dashboard/catalog/leads/reservations/commissions
mappers + repo error mapping + cubits + permission-fallback (403). Both apps compile; boundary
greps pass; zero Riverpod. No backend touched → no jest run.

## 12. Final QA + Release Polish — completed 2026-05-28

End-of-build audit across navigation, UI/UX, l10n, error handling, security,
performance, native release, testing, and docs. **No new features.** Three
verified defects fixed, three regression tests added, and a release guide
shipped at [`docs/mobile-release-guide.md`](mobile-release-guide.md).

**Fixed:**
1. **Dio `LogInterceptor` was logging bearer token + request body** in debug
   builds (default `requestHeader: true`). Now `requestHeader`, `requestBody`,
   `responseHeader`, `responseBody` are all `false` — only the request line
   and response status are logged, and only under `kDebugMode &&
   env.enableLogging`. Touches `packages/core/lib/src/network/dio_client.dart`.
2. **Signed R2 upload URL could leak into `AppFailure.technicalMessage`** if
   the direct-to-storage PUT failed: `DioErrorMapper._technical` records
   `e.requestOptions.path`, which on the upload client is the full signed URL.
   `MaintenanceRemoteDataSourceImpl.putToSignedUrl` now catches the
   `DioException` and rethrows with `requestOptions.path = '[r2-upload]'`
   (type/status preserved so error mapping stays accurate). Test:
   `mobile_customer/test/signed_url_redaction_test.dart`.
3. **RTL chip padding** used `EdgeInsets.only(right: …)` in 5 staff screens
   (broker reservations + leads, sales reservations + visits + leads) — flipped
   to `EdgeInsetsDirectional.only(end: …)` so Arabic mirrors correctly.

**Regression tests added (all passing):**
- `packages/core/test/l10n_completeness_test.dart` — ar/en ARB files define
  the same message keys; every placeholder-bearing `@`-entry mirrors across
  locales.
- `packages/core/test/theme_smoke_test.dart` — light/dark themes build for
  ar/en and carry `AppColorsExt` (with a guarded zone that swallows the
  expected google_fonts "asset not bundled" error in hermetic tests).
- `mobile_customer/test/signed_url_redaction_test.dart` — see fix #2.

**Verified, no change required:**
- Tokens live only in `flutter_secure_storage` via `TokenStorage` (never in
  SharedPreferences, never in logs).
- No provider API keys in the mobile bundle (Twilio, FCM credentials are
  backend-side; mobile only ever sees the bearer token).
- Customer financial screens (contracts, deposits, installments) are behind
  the CUSTOMER/CLIENT role guard via `staffRedirect` / `customerRedirect`.
- Broker is bounced out of `/sales/*` and Sales/Manager out of `/broker/*` —
  both directions unit-tested in §11.
- `DebugErrorReporter` is `kDebugMode`-gated; release builds report nothing.
- `AppSkeletonizer` honors `MediaQuery.disableAnimations` (system "Reduce
  Motion").
- Both apps' `applicationId` / `namespace` are distinct
  (`com.realestate.customer.mobile_customer`,
  `com.realestate.staff.mobile_staff`) and ready to rename once the real
  reverse-domain is chosen.

**Known limitations carried forward** (documented in release guide §8):
installment formula is client-side (API gap), Staff AI assistant deferred,
Admin mobile out of scope, payments out of scope, native splash still default.

**Verification:** `flutter analyze` clean in core + mobile_customer +
mobile_staff; **24 core + 90 customer + 112 staff** tests pass; both apps
compile; boundary greps pass; zero Riverpod. No backend touched → no jest run.

## 13. Phase 6 — Native release setup + store readiness (2026-05-28)

End-of-Phase-6 the apps are **store-shaped but unbranded**: native config
plumbing is wired into both apps so a release engineer can drop secrets +
brand assets at known paths and ship, with no code edit that touches
business logic. **No `firebase_core` / `firebase_messaging` deps were
added** — those wait until the four config files exist AND a real-device
push delivery has been observed, so the app never claims push works
when it doesn't.

**Wired (committed):**
- Android `INTERNET` permission declared explicitly in both
  `AndroidManifest.xml` — debug auto-injects, release manifest needs it
  declared.
- Both apps' `android/app/build.gradle.kts` load release-signing creds
  from an untracked `android/key.properties` and fall back to the debug
  key when absent. `flutter run --release` + CI smoke builds work
  without secrets; the keystore + `key.properties` are gitignored.
- Per-app `android/key.properties.example` documents the four expected
  keys.
- Per-app Firebase placeholders next to canonical drop paths:
  `android/app/google-services.json.example` and
  `ios/Runner/GoogleService-Info.plist.example`. Each contains the full
  step-by-step integration instructions inline.
- Workspace `apps/mobile/.gitignore` is a defence-in-depth safety net:
  ignores real `google-services.json`, `GoogleService-Info.plist`,
  `key.properties`, `*.keystore` / `*.jks` / `*.p8` / `*.p12` /
  `*.mobileprovision`, `.env`, `secrets/`; explicitly negates so
  `*.example` placeholders stay tracked.
- New companion: [`docs/mobile-store-readiness.md`](mobile-store-readiness.md)
  — Play Internal / TestFlight / privacy / Data Safety / screenshot
  specs / test-account requirements / listing copy slots.
- Release guide §9 documents Phase 6 status, signing recipes,
  `--dart-define` overrides, and the TODO checklist.

**Deliberately NOT done this phase (per scope):**
- No `applicationId` / bundle ID / display name changes (need final
  values from product).
- No launcher icon / splash assets (no brand assets in repo; "do not
  use random/generated assets").
- No `firebase_core` / `firebase_messaging` deps (no real creds; would
  half-wire push and risk shipping a broken experience).
- No `EnvConfig` URL / phone-number changes (need real values).

**Verification (this phase):** analyze clean ×3; **28 core + 91 customer
+ 112 staff = 231 tests pass** (unchanged from Final QA); both debug
APKs build clean; both release AABs build clean and fall back to the
debug-key signature exactly as the scaffold intends (note: do NOT
upload a debug-signed AAB to Play); iOS no-codesign release build
attempted; Clean Architecture boundaries pass; zero Riverpod; secret
grep across the mobile tree clean (no `AKIA…`, `AIza…`, `-----BEGIN`,
`sk-`, `xoxb-`).

**Sign-off blockers carried into the store-readiness checklist:** final
reverse-domain IDs, display names ar+en, launcher icons, splash assets,
Firebase project + 4 config files + APNs key, Twilio prod live, Android
upload keystore, iOS Distribution cert + provisioning profile,
real-device push QA, staging+prod API URLs, WhatsApp+contact numbers,
one-time Xcode "add Arabic localization" step on the Customer Runner.
Full list with status in
[`docs/mobile-store-readiness.md`](mobile-store-readiness.md) §1–§7.

## Sequencing

Per the approved plan (parallel track): start **OpenAPI export** and **FCM wiring** now,
alongside the Flutter foundation. Gate **Phase 3** customer-financial + notification
screens on the ownership guard + signed downloads + FCM delivery being live.
**Update (2026-05-27):** Phase 3A/3B/3C/3C.1 all built; remaining prod blockers are real FCM
credentials + Twilio SMS (see §5) and the one-time iOS Xcode step for localized photo prompts
(§7). **Update (2026-05-28):** Phases 4A/4B/4C/5 + Final QA shipped (§§8–12); see
[`docs/mobile-release-guide.md`](mobile-release-guide.md) for build/QA/sign-off gates.
**Update (2026-05-28, later same day):** Phase 6 native release setup shipped (§13);
all remaining blockers are external assets/credentials, tracked in
[`docs/mobile-store-readiness.md`](mobile-store-readiness.md).
