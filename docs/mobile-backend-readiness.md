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

## Sequencing

Per the approved plan (parallel track): start **OpenAPI export** and **FCM wiring** now,
alongside the Flutter foundation. Gate **Phase 3** customer-financial + notification
screens on the ownership guard + signed downloads + FCM delivery being live.
**Update (2026-05-27):** Phase 3A/3B/3C/3C.1 all built; remaining prod blockers are real FCM
credentials + Twilio SMS (see §5) and the one-time iOS Xcode step for localized photo prompts
(§7).
