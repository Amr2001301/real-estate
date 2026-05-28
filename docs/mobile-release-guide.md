# Mobile Release Guide — Customer + Staff apps

**Status:** Final QA + Release Polish complete (2026-05-28). Both apps build,
analyze clean, all tests pass. **Not yet shipped to stores** — blockers are
external (Firebase project + Twilio account + signing certs), not in-app.

Use this guide to (a) run the apps locally per flavor, (b) produce release
artefacts for TestFlight / Play Internal, (c) manually QA the release before
promotion. The architecture/contract reference is
[`docs/mobile-backend-readiness.md`](mobile-backend-readiness.md); read its
§12 first if any backend behaviour seems off.

---

## 1. Repo layout

```
apps/mobile/
  packages/core/           # shared: theme, l10n (ar/en), Dio, AppFailure, widgets, Session
  mobile_customer/         # Guest / Client / Customer app
    lib/main_dev.dart      # → EnvConfig(dev),     base = http://localhost:4000/v1
                           #   (override per-run with --dart-define=API_BASE_URL=...
                           #    for Android emulator → host loopback, use 10.0.2.2:4000)
    lib/main_staging.dart  # → EnvConfig(staging), base = configurable via --dart-define
    lib/main_prod.dart     # → EnvConfig(prod),    base = https://api.realestate.example
  mobile_staff/            # Sales / Sales Manager / Maintenance Sup. / Broker
    lib/main_*.dart        # same three flavors
```

Managed as a Melos pub-workspace (`apps/mobile/pubspec.yaml` has
`workspace: [packages/core, mobile_customer, mobile_staff]`). One
`flutter pub get` from `apps/mobile/` resolves all three.

---

## 2. Daily run commands

```bash
# from apps/mobile/
flutter pub get

# Customer — dev flavor against a NestJS API on the host machine
cd mobile_customer
flutter run -t lib/main_dev.dart

# Staff — dev
cd ../mobile_staff
flutter run -t lib/main_dev.dart
```

The dev base URL baked into `EnvConfig.dev` is `http://localhost:4000/v1`
(matches the backend `apps/api` default). Common overrides:

```bash
# Android emulator → host loopback (Postgres + API on the Mac):
flutter run -t lib/main_dev.dart \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000/v1

# Physical iOS device pointed at the Mac dev server:
flutter run -t lib/main_dev.dart \
  --dart-define=API_BASE_URL=http://192.168.x.x:4000/v1

# Staging API:
flutter run -t lib/main_staging.dart \
  --dart-define=API_BASE_URL=https://staging-api.example.com/v1
```

`EnvConfig.initialize` reads `API_BASE_URL` (and friends) as
`--dart-define` overrides — see `packages/core/lib/src/env/env_config.dart`.

---

## 3. Release build commands

### Android (App Bundle for Play)

```bash
# from apps/mobile/mobile_customer
flutter build appbundle --release -t lib/main_prod.dart

# Output: build/app/outputs/bundle/release/app-release.aab
```

```bash
# from apps/mobile/mobile_staff
flutter build appbundle --release -t lib/main_prod.dart
```

Signing: configure `android/key.properties` (untracked) with `storeFile=`,
`storePassword=`, `keyAlias=`, `keyPassword=`. `app/build.gradle.kts` already
reads it via the standard Flutter template; see Android signing keys
checklist below.

### iOS (Archive for TestFlight)

Use Xcode for the final archive (signing UI is more reliable there), but the
sanity build runs from CLI:

```bash
# from apps/mobile/mobile_customer
flutter build ios --release -t lib/main_prod.dart --no-codesign

# Then open ios/Runner.xcworkspace in Xcode → Product → Archive
```

Same for `mobile_staff`. Both apps already have iOS usage descriptions
localized (`en.lproj/`, `ar.lproj/`).

---

## 4. Native config checklist (per app, before first store upload)

### Android
- [ ] `android/app/build.gradle.kts` `applicationId` — **set**:
      `com.realestate.customer.mobile_customer`,
      `com.realestate.staff.mobile_staff`. Change to your real reverse-domain
      before first upload (Play won't let you change it later).
- [ ] `versionCode` / `versionName` — bump per upload. Currently `1+1`.
- [ ] App label in `android/app/src/main/AndroidManifest.xml`
      (`android:label`) — replace `"mobile_customer"` / `"mobile_staff"`
      with the user-facing brand name (or localize via `@string/app_name`).
- [ ] `INTERNET` permission — Flutter adds it automatically for debug; for
      release builds you should add an explicit
      `<uses-permission android:name="android.permission.INTERNET" />`.
- [ ] Launcher icons — replace `mipmap-*/ic_launcher.png` (the default
      Flutter icon is still in place). Use `flutter_launcher_icons`.
- [ ] Splash — replace `drawable*/launch_background.xml` (we use Material 3
      splash via the engine; no extra package).
- [ ] Signing — see `key.properties` + `signingConfigs.release` block.

### iOS
- [ ] `CFBundleDisplayName` in `ios/Runner/Info.plist` — already set; verify.
- [ ] Bundle ID in `ios/Runner.xcodeproj/project.pbxproj`
      (`PRODUCT_BUNDLE_IDENTIFIER`) — change to your real reverse-domain.
- [ ] `CFBundleShortVersionString` + `CFBundleVersion` — bump per upload.
- [ ] Photo & camera usage strings — Customer app has
      `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`,
      `NSPhotoLibraryAddUsageDescription` in `Info.plist`. Localized
      versions live in `en.lproj/InfoPlist.strings` and
      `ar.lproj/InfoPlist.strings`. **Xcode requirement:** open the project
      once and add `English` + `Arabic` under Project ▸ Info ▸ Localizations
      so Xcode copies the `.lproj/` folders into the bundle.
- [ ] Launch screen — `LaunchScreen.storyboard` is the default; replace
      with branded assets.
- [ ] Signing — Team + Provisioning Profile in Xcode (Automatic is fine for
      TestFlight, manual for Distribution).

### Both
- [ ] Firebase project — both apps consume `firebase_core` placeholders
      (`google-services.json` for Android, `GoogleService-Info.plist` for
      iOS) — currently empty stubs. Create the project, register both
      bundle IDs, drop the files, **then** FCM will deliver. See
      `docs/mobile-backend-readiness.md` §2.
- [ ] APNs key uploaded to Firebase (iOS).
- [ ] OAuth/SMS provider keys (Twilio for OTP) — backend-side, but the
      mobile app reads `EnvConfig.otpEnabled` to decide if it should
      show the OTP screen at all.

---

## 5. Backend readiness (must be green before first prod upload)

The mobile apps depend on backend behaviour that is otherwise stubbed:

1. **FCM credentials live** — see `docs/mobile-backend-readiness.md` §2.
   Until then, push notifications no-op silently; in-app inbox still works.
2. **Twilio SMS live** — required for the customer OTP login flow. With
   it stubbed, `requestOtp` returns the code in the response body (dev
   only) and the app's `EnvConfig.otpEnabled` should stay `false` in prod.
3. **Ownership guard on financial endpoints** — see §3 of readiness.
4. **Signed-download URL TTL** for documents — readiness §7. Customer +
   Sales document viewers always re-mint just-in-time and never persist a
   URL, so any TTL works, but ≤ 5 min is what we test against.

---

## 6. Manual QA checklist (per release candidate)

Run on one Android device + one iOS device, both with Arabic UI and again
with English UI. **30–40 minutes total** per app once you're warm.

### Customer app — Arabic + English, light + dark

- [ ] Cold start ≤ 3s on mid-range device (Pixel 5 / iPhone 12).
- [ ] Splash → Login appears with no flash of unstyled content.
- [ ] Phone-OTP login → home. Wrong OTP shows a localized error (no raw
      Dio message). 401 after token expiry triggers a silent refresh and
      retries the failed request.
- [ ] Browse projects → unit detail. Images load via signed URLs and
      Skeletonizer covers the loading state (with no shimmer if
      "Reduce Motion" is on in OS settings).
- [ ] Favorites: tap heart, kill app, reopen → still favorited.
- [ ] Visit request from a unit. Confirmation toast localized.
- [ ] Maintenance request creation with **2 photos**. Verify in the
      backend that documents are registered and `fileUrl` is the R2 key,
      not a signed URL.
- [ ] Open a contract / deposit / installment screen — values render with
      `PriceFormatter` (thousands separator localized; ar uses Arabic-Indic
      digits if you wired that).
- [ ] Toggle language in Profile → app rebuilds in the other language
      without re-login. RTL/LTR flips chip alignment, padding, icons.
- [ ] Toggle theme in Profile → dark mode applies system-wide.
- [ ] Log out → returns to login; secure storage cleared (next launch is
      guest).

### Staff app — Sales role

- [ ] Login as a SALES user. Dashboard shows bonus + target tiles.
- [ ] Leads → create lead → call/WhatsApp/email actions launch external
      intents (no app crash if WhatsApp not installed; falls back to a
      localized "no handler" snackbar).
- [ ] Clients list paginates; pull-to-refresh works.
- [ ] Visits → create visit → status updates round-trip.
- [ ] Reservations → create reservation (no admin-approval step).
- [ ] Installment Calculator: change unit price, plan, down payment;
      values update synchronously. Formula source documented in screen
      footer / About.
- [ ] Sales Profile shows performance summary.
- [ ] All screens RTL when Arabic.

### Staff app — Broker role

- [ ] Login as a BROKER. **Cannot** route to `/sales/*` (staffRedirect
      kicks you back to `/broker/home`).
- [ ] Dashboard shows KPIs + recent leads/reservations.
- [ ] Commissions tile **hidden** if `canViewCommissions=false`; if
      visible, opens commissions screen.
- [ ] Projects → broker-scoped list (only projects with grants). Tap a
      project → unit list via `/portal/units?projectId`.
- [ ] Leads → create lead. Reservations → create reservation (lead
      required).
- [ ] If `/portal/commissions` 403s the screen shows the localized
      forbidden state, not a raw error.

### Cross-cutting

- [ ] No raw `DioException` text appears anywhere in the UI.
- [ ] No bearer token, signed URL, or password ever appears in `flutter
      logs` (release builds strip `debugPrint` and `LogInterceptor` is
      `kDebugMode`-gated regardless).
- [ ] Backgrounding the app and returning preserves navigation stack
      (no forced re-login while access token is valid).
- [ ] Network drop → request shows a localized "you're offline" failure
      (not a Dio stack trace).

---

## 6.1 One-shot local release verification (Phase 7F)

After the per-app daily commands in §2, run the consolidated
verification script before tagging a release candidate:

```bash
# Quick gate (no DB/services needed — 6 sections; Playwright + e2e skip):
bash scripts/release-verify.sh

# Full gate — start Postgres + API + both web apps first, then:
export TEST_DATABASE_URL=postgresql://postgres@localhost:5432/realestate_e2e?schema=public
bash scripts/release-verify.sh
```

The script walks 8 sections (backend unit, backend e2e, web-admin
Playwright, web-public Playwright, mobile analyze+test, zero
Riverpod, Clean Architecture boundaries, no-secrets grep) and exits
non-zero if any required gate fails. Sections gracefully skip with
a clear "what's needed" message when their prereqs (`TEST_DATABASE_URL`,
running services) aren't met. Full description in
[`docs/system-qa-strategy.md`](system-qa-strategy.md) §0.7.

## 7. Sign-off gates

Before promoting a build to TestFlight external / Play production:

| Gate | Owner | Pass criteria |
| --- | --- | --- |
| Mobile tests | Eng | `flutter test` from `packages/core`, `mobile_customer`, `mobile_staff` all green |
| Static analysis | Eng | `flutter analyze` clean in all three packages |
| Backend tests | Eng | `pnpm --filter @api test` green (only required if backend changed in the release) |
| Manual QA | QA | §6 checklist signed off on iOS + Android, both languages |
| Backend readiness | Eng | §5 items 1–4 all green (FCM, Twilio, ownership guard, signed-download TTL) |
| Stores | Release | App listings (icon, screenshots, description ar+en) populated; privacy nutrition labels (iOS) filled |

---

## 8. Known limitations (carry-forward, not release-blocking)

- **Installment formula is client-side.** The backend has no endpoint to
  return a canonical schedule yet — see `mobile-backend-readiness.md` §10
  for the API gap. Tests pin the current formula so any drift is caught.
- **Staff AI assistant not built** — Phase deferred. Customer chat is
  rule-based with an LLM-ready abstraction.
- **Admin mobile not built** — out of scope. Admin uses the web portal.
- **Payments not built** — out of scope; would require PCI review.
- **Native splash is the default Flutter splash** on both apps until the
  brand assets land — see §4.

For the full status snapshot see
[`docs/mobile-backend-readiness.md`](mobile-backend-readiness.md) §12.

---

## 9. Phase 6 — Native release setup (status 2026-05-28)

End-of-Phase-6 the apps are **store-shaped but unbranded**: native config is
wired so a release engineer can drop secrets + assets into known paths and
ship, without any code edit that touches business logic. Nothing in this
phase claims push works in production — that gate requires a real-device
delivery, see §5 / §9.4 below.

### 9.1 What Phase 6 added

- Explicit `android.permission.INTERNET` declared in both apps'
  `AndroidManifest.xml`. Flutter auto-injects it for debug builds only; the
  release manifest needed it stated so production AAB/APK builds keep
  network access.
- Both apps' `android/app/build.gradle.kts` now load release-signing
  credentials from an untracked `android/key.properties` when present and
  fall back to the debug key when absent — so `flutter run --release` and
  CI smoke builds still work without secrets. The keystore + properties
  file are gitignored (per-app `android/.gitignore` already covered them;
  workspace [`apps/mobile/.gitignore`](../apps/mobile/.gitignore) adds the
  defence-in-depth second layer).
- Per-app `android/key.properties.example` documents the four expected
  keys (`storePassword`, `keyPassword`, `keyAlias`, `storeFile`).
- Per-app Firebase placeholders — `android/app/google-services.json.example`
  and `ios/Runner/GoogleService-Info.plist.example` — document the
  canonical drop paths + the rest of the integration steps inline.
- Workspace [`apps/mobile/.gitignore`](../apps/mobile/.gitignore) is a
  belt-and-braces safety net: ignores real `google-services.json`,
  `GoogleService-Info.plist`, `key.properties`, `*.keystore` / `*.jks` /
  `*.p8` / `*.p12` / `*.mobileprovision`, `.env`, and `secrets/`; leaves
  every `*.example` file tracked via explicit negations.
- New companion checklist: [`docs/mobile-store-readiness.md`](mobile-store-readiness.md).

### 9.2 Signing-config command recipes

```bash
# One-time per app: drop key.properties next to android/ and a keystore at the
# path it points to (NOT in git). Then a release build is signed with the
# upload key without any further config change:

cd apps/mobile/mobile_customer
flutter build appbundle --release -t lib/main_prod.dart
# → build/app/outputs/bundle/release/app-release.aab (signed with upload key)
```

Verify the AAB is signed with your upload key (not debug):

```bash
keytool -printcert -jarfile build/app/outputs/bundle/release/app-release.aab
# Owner / Issuer must match your upload-key certificate.
```

To smoke-test the release path on a dev machine without a real keystore,
omit `key.properties` and the build falls back to the debug key — **never
upload a debug-signed AAB to Play**.

### 9.3 Dart-define overrides (no recompile-per-env)

`EnvConfig.initialize` already reads `--dart-define` overrides. Phase 6 adds
no new keys; the existing one matters most for staging/prod testing on
real backends:

```bash
flutter run -t lib/main_dev.dart \
  --dart-define=API_BASE_URL=https://staging-api.example.com/v1
```

`API_BASE_URL` overrides the preset baked into `EnvConfig.dev/staging/prod`.
Until the real `*.example.com` placeholders in
[`packages/core/lib/src/env/env_config.dart`](../apps/mobile/packages/core/lib/src/env/env_config.dart)
are replaced, `--dart-define=API_BASE_URL=…` is the only way to point
staging / prod builds at real backends.

### 9.4 What still needs you (TODO checklist)

Strictly external — none of these can be done from inside the repo without
you handing over an asset / credential / decision:

- [ ] **Final Customer Android `applicationId`** (production reverse-domain). Replace
      `com.realestate.customer.mobile_customer` in
      [`mobile_customer/android/app/build.gradle.kts`](../apps/mobile/mobile_customer/android/app/build.gradle.kts).
- [ ] **Final Customer iOS bundle ID** — set
      `PRODUCT_BUNDLE_IDENTIFIER` in
      `mobile_customer/ios/Runner.xcodeproj/project.pbxproj`.
- [ ] **Final Staff Android `applicationId`** — same edit in
      [`mobile_staff/android/app/build.gradle.kts`](../apps/mobile/mobile_staff/android/app/build.gradle.kts).
- [ ] **Final Staff iOS bundle ID** — same edit on the Staff Xcode project.
- [ ] **Per-flavor applicationId suffix policy** (recommended `.dev`,
      `.staging`, prod = no suffix) so testers can install dev + staging +
      prod side-by-side. Currently all three flavors share one ID per app.
- [ ] **Arabic + English display names** for both apps — Android
      `android:label` + iOS `CFBundleDisplayName` (and localized
      `CFBundleDisplayName` in `ios/Runner/{en,ar}.lproj/InfoPlist.strings`).
- [ ] **Launcher icons**: 1024×1024 PNG per app for iOS, foreground +
      background hex for the Android adaptive icon. Wire with
      `flutter_launcher_icons` (dev_dependency, not yet added — needs the
      asset first).
- [ ] **Splash assets**: transparent ~512px logo PNG per app + brand-color
      hex for the splash background. Wire with `flutter_native_splash`
      (dev_dependency, not yet added — needs the asset first).
- [ ] **Firebase project + 4 config files** dropped at the documented
      paths (see the four `*.example` files). **Do not paste the real
      files in chat** — drop them at the canonical paths and let
      `.gitignore` catch them.
- [ ] **APNs `.p8` key** uploaded to Firebase Console; Team ID + Key ID
      noted somewhere outside this repo.
- [ ] **Twilio production SMS** turned live on the backend (`apps/api`
      env). Then flip `EnvConfig.otpEnabled` true for prod builds.
- [ ] **Android upload keystore** + `key.properties` per app (paths
      documented in §9.2; both gitignored).
- [ ] **iOS Distribution cert + provisioning profile** in Xcode for each
      app's Runner target.
- [ ] **Staging + prod API base URLs** — replace the `*.example.com`
      placeholders in
      [`packages/core/lib/src/env/env_config.dart`](../apps/mobile/packages/core/lib/src/env/env_config.dart)
      (or keep using `--dart-define=API_BASE_URL=…` for staging-only).
- [ ] **WhatsApp number + contact phone** per env — all three `EnvConfig`
      presets currently have empty strings, which hides the CTA chips.
- [ ] **On-device push QA** — one iOS + one Android device. **Until a
      real delivery is observed, push is documented as not production
      ready** (see §5).
- [ ] **One-time Xcode step on the Customer iOS Runner**: open the
      project and add `English` + `Arabic` under Project ▸ Info ▸
      Localizations so the existing `en.lproj/ar.lproj/InfoPlist.strings`
      files get bundled (otherwise camera / photo prompts fall back to
      English on the device).
