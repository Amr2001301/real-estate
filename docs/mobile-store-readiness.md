# Mobile Store Readiness Checklist — Customer + Staff

Companion to [`docs/mobile-release-guide.md`](mobile-release-guide.md). The
release guide covers **how to build and QA**; this doc covers **what you
need outside the codebase to ship a build to Play Internal / TestFlight
and from there to production**. Work through it twice — once per app.

> Phase 6 (2026-05-28) wired the codebase plumbing so most rows below are
> "needs your asset / credential / decision," not "needs another phase."

---

## 1. Pre-upload: identity + assets

| Item | Per app? | Required for | Status |
| --- | --- | --- | --- |
| Final Android `applicationId` (reverse-domain) | Yes | Play upload (immutable after first upload) | **Needs decision** |
| Final iOS bundle ID (reverse-domain) | Yes | TestFlight upload (immutable after first upload) | **Needs decision** |
| App display name (en) | Yes | Both stores | **Needs decision** |
| App display name (ar) | Yes | Both stores (localized listing) | **Needs decision** |
| Per-flavor `applicationId` suffix policy (`.dev`, `.staging`) | Yes | Side-by-side installs for testers | **Needs decision** |
| Launcher icon — 1024×1024 PNG | Yes | Both stores | **Needs asset** |
| Adaptive icon foreground + background hex | Yes (Android) | Play upload | **Needs asset** |
| Splash logo + brand background hex | Yes | Branded splash (replaces default Flutter splash) | **Needs asset** |
| Android upload keystore (`.jks` + `key.properties`) | Yes | Play upload | **Needs asset** |
| iOS Distribution cert + provisioning profile | Yes | TestFlight upload | **Needs asset (Apple Developer Program)** |

Storage:
- Keystore + `key.properties` live OUTSIDE git. Path inside the repo is
  ignored by both `apps/mobile/<app>/android/.gitignore` and
  [`apps/mobile/.gitignore`](../apps/mobile/.gitignore).
- iOS signing material is managed by Xcode / Apple Developer Portal — not
  in the repo at all.

---

## 2. Firebase / push

| Item | Per app? | Required for | Status |
| --- | --- | --- | --- |
| Firebase project | One or two | FCM + Crashlytics later | **Needs creation** |
| Android app registered + `google-services.json` dropped | Yes | Android push | **Needs file** (path: `apps/mobile/<app>/android/app/google-services.json`) |
| iOS app registered + `GoogleService-Info.plist` dropped | Yes | iOS push | **Needs file** (path: `apps/mobile/<app>/ios/Runner/GoogleService-Info.plist`) |
| APNs `.p8` key uploaded to Firebase Console | Once | iOS push delivery | **Needs upload** |
| `firebase_core` + `firebase_messaging` added to pubspecs | Yes | Wires FCM into the app | **Deliberately deferred** — Phase 6 left this off so an unwired Firebase project can't ship a half-working push experience |
| `NoopPushTokenProvider` swapped for real implementation in `bootstrap.dart` | Yes | App-side token refresh | **Deliberately deferred** — done together with the deps + a real device QA |
| **Observed delivery on a real iOS device + real Android device** | Yes (each) | **Sign-off gate** | **Until this is green, push is documented as not production-ready** |

The four `*.example` placeholders next to the canonical paths document the
exact integration steps inline:

- [`apps/mobile/mobile_customer/android/app/google-services.json.example`](../apps/mobile/mobile_customer/android/app/google-services.json.example)
- [`apps/mobile/mobile_staff/android/app/google-services.json.example`](../apps/mobile/mobile_staff/android/app/google-services.json.example)
- [`apps/mobile/mobile_customer/ios/Runner/GoogleService-Info.plist.example`](../apps/mobile/mobile_customer/ios/Runner/GoogleService-Info.plist.example)
- [`apps/mobile/mobile_staff/ios/Runner/GoogleService-Info.plist.example`](../apps/mobile/mobile_staff/ios/Runner/GoogleService-Info.plist.example)

---

## 3. Backend prod-readiness gates

These live in `apps/api`, not mobile, but block real-device QA:

| Item | Verifies | Status |
| --- | --- | --- |
| Twilio account live + verified sender | Customer OTP login in prod | **Needs credentials** (backend) |
| Firebase service-account JSON loaded into backend `FIREBASE_*` env | Server-initiated push | **Needs credentials** (backend) |
| R2 access key + secret + bucket | Document storage + signed downloads + signed PUT uploads | **Needs credentials** (backend) |
| Signed-download endpoint TTL ≤ 5 min | Documented contract | ✅ implemented (`R2Service.createPresignedDownload`) |
| Centralized ownership guard (`OwnershipService`) used on every `/me/*` document path | Cross-tenant safety | ✅ implemented |
| OpenAPI export script (`pnpm --filter api openapi:export`) runnable in CI | Mobile model generation | ✅ implemented |
| FCM delivery test from staging to a real device | Push sign-off | **Pending creds + device** |
| No secrets committed in mobile repo | Always | ✅ verified by grep (Phase 6 final verification) |

Cross-reference: [`docs/mobile-backend-readiness.md`](mobile-backend-readiness.md) §2–§5 + §12 + §13.

---

## 4. Privacy + permissions

### What we actually request

| OS | Permission | Triggered by | Customer | Staff |
| --- | --- | --- | --- | --- |
| iOS | `NSCameraUsageDescription` | Maintenance photo via camera | ✅ Yes | — |
| iOS | `NSPhotoLibraryUsageDescription` | Maintenance photo from library | ✅ Yes | — |
| iOS | `NSPhotoLibraryAddUsageDescription` | Saving a photo back | ✅ Yes | — |
| Android | (none beyond INTERNET) | System photo picker handles its own permission | ✅ N/A | ✅ N/A |
| Android | `INTERNET` | All HTTP traffic | ✅ Yes | ✅ Yes |
| iOS / Android | Push notifications | After login (deferred opt-in) | — (until FCM wired) | — (until FCM wired) |

When FCM is wired (post-Phase 6) we'll also need:
- Android `POST_NOTIFICATIONS` runtime prompt on Android 13+ (the
  `firebase_messaging` plugin's manifest merge declares the permission;
  the app must request it after login).
- iOS `UNUserNotificationCenter.requestAuthorization` (the
  `firebase_messaging` plugin wires this when initialized).

### Privacy policy

**Needs URL.** Both stores require a public privacy-policy URL. It must
cover at minimum:

- What personal data the app collects (email, phone, name, profile,
  maintenance-request photos, push tokens, optional location of a
  requested visit).
- Why each is collected (authentication, support, brokerage).
- Third-party processors (Cloudflare R2 for documents, Firebase for push,
  Twilio for SMS OTP, backend API host).
- How a user requests deletion (link to in-app "delete account" if/when
  added, or support email).
- Retention period.
- Contact email for data-protection inquiries.

### Permission rationale copy (for the stores)

Each store asks why you need each permission. Suggested copy (en) — final
wording is your call:

- **Camera (iOS / Customer)**: "Used to attach a photo to a maintenance
  request you create."
- **Photo Library (iOS / Customer)**: "Used to attach existing photos to
  a maintenance request and save photos related to your requests."
- **Push Notifications (when wired)**: "Used to notify you about updates
  to your visits, maintenance requests, and account."

Arabic placeholders live in
[`apps/mobile/mobile_customer/ios/Runner/ar.lproj/InfoPlist.strings`](../apps/mobile/mobile_customer/ios/Runner/ar.lproj/InfoPlist.strings) —
review and confirm before upload.

### Apple Privacy Nutrition Label (App Store Connect)

| Data type | Linked to user? | Used for tracking? | Purpose |
| --- | --- | --- | --- |
| Email address | Yes | No | App functionality (account) |
| Phone number | Yes | No | App functionality (auth, contact) |
| Name | Yes | No | App functionality |
| Photos (maintenance) | Yes | No | App functionality |
| Coarse location (if visit address) | Yes | No | App functionality |
| Device ID (push token) | Yes | No | App functionality |
| Crash data (when Crashlytics added) | No | No | App functionality |
| Performance data | No | No | App functionality |

### Google Play Data Safety

Same categories as above. Play also requires:
- A clear statement on whether data is **shared** with third parties (it
  is, with Cloudflare R2 for document storage and Firebase for push — list
  them).
- A clear statement on whether data is **encrypted in transit** (yes —
  HTTPS only) and **at rest** (yes — backend DB encryption + R2 server-side
  encryption).
- Whether users can request deletion (link to your in-app or web flow).

---

## 5. Listing assets per app, per locale

For Customer + Staff × en + ar:

| Asset | Spec | Status |
| --- | --- | --- |
| App title | Play 30 chars; App Store 30 chars | **Needs copy** |
| Short description | Play 80 chars | **Needs copy** |
| Long description | Play 4000 chars; App Store description ~4000 chars | **Needs copy** |
| Promotional text (App Store only) | 170 chars | **Needs copy** |
| Keywords (App Store only) | 100 chars, comma-separated | **Needs copy** |
| Feature graphic (Play only) | 1024×500 PNG | **Needs asset** |
| Phone screenshots | Play: 16:9 or 9:16, min 320px short side; App Store: 6.7" + 6.5" + 5.5" | **Needs screenshots** |
| 7" tablet screenshots | Play: 1024×600 min | **Needs screenshots** (if tablet-targeted) |
| 10" tablet screenshots | Play: 1280×800 min; App Store: 12.9" + 11" | **Needs screenshots** (if tablet-targeted) |
| App icon | 512×512 PNG (Play); 1024×1024 (App Store) | **Needs asset** |
| Content rating questionnaire | Play | **Needs filling** (no UGC, no ads, no gambling — should land at "Everyone" / 3+) |
| Age rating | App Store | **Needs filling** (likely 4+) |
| Support URL | Must resolve | **Needs URL** |
| Marketing URL (optional) | Must resolve | Optional |
| Privacy URL | Required | **Needs URL** |

Suggested screenshot scenes (each app, ar + en, dark + light = 4 captures
per scene):

**Customer**: login, project list, project detail, unit detail with
favorite/compare, account hub, maintenance request creation, maintenance
detail with photo, contracts list.

**Staff (Sales)**: dashboard with KPI tiles + bonus card, leads list,
lead detail with timeline, visit creation, reservation creation,
installment calculator, profile with performance.

**Staff (Broker)**: broker dashboard, broker projects, broker leads,
broker reservations, commissions (with permission flag on).

---

## 6. Test accounts

Both stores require test credentials for the reviewer.

- [ ] **Customer test account** — phone-OTP login, with at least: one
      contract, one paid + one pending deposit, one in-progress
      maintenance request with a photo, one upcoming visit, one
      notification. Provide either: (a) a real phone the reviewer can
      receive an SMS on, OR (b) a backend-seeded test account whose OTP
      is logged and read back via a "dev OTP" flow that you'll temporarily
      enable for review only.
- [ ] **Staff (Sales) test account** — email-password login with leads +
      visits + reservations and a target row so the dashboard isn't empty.
- [ ] **Staff (Broker) test account** — email-password login with a
      broker portal grant on at least one project, with `canViewCommissions=true`
      so the reviewer sees the gated screens.

Document the credentials in the App Store Connect / Play Console review
notes — **never in the repo**.

---

## 7. Internal testing (pre-production)

### Play Console — Internal testing

1. Create the app entry with the final `applicationId`.
2. Upload the first signed AAB to **Internal testing** track.
3. Add tester emails to the internal-tester list (max 100).
4. Share the opt-in URL; testers install via Play.
5. Iterate signed AABs until QA passes §6 of the release guide.
6. Promote to **Closed testing** (alpha) → **Open testing** (beta) →
   **Production** when content rating / data safety / listing assets all
   green-light.

### TestFlight

1. Archive the app in Xcode (Distribution signing) and upload via
   Organizer.
2. Wait for processing (5–30 min). Resolve any export-compliance prompt
   (the app uses HTTPS only — standard exemption applies).
3. Add internal testers (max 100, all Apple IDs on your team).
4. After validation, add external testers (up to 10000) — requires a
   short app review (~24h first time).
5. Iterate until QA passes §6 of the release guide.
6. Submit for App Store review when listing assets are in place.

---

## 8. Sign-off (per release)

Copy this block into the release ticket; tick when verified.

- [ ] `flutter analyze` clean on core + customer + staff
- [ ] `flutter test` green on core + customer + staff
- [ ] Both APKs build clean (`flutter build apk --release -t lib/main_prod.dart`)
- [ ] Both AABs build clean and are signed with the **upload key**, not debug
- [ ] iOS archives signed by Distribution cert + valid provisioning profile
- [ ] Manual QA passed on iOS + Android, ar + en (release guide §6)
- [ ] Backend FCM credentials live (release guide §5 / readiness §2)
- [ ] Twilio production SMS live (release guide §5 / readiness §5)
- [ ] Ownership guard verified on all `/me/*` document paths (readiness §3)
- [ ] On-device push delivery observed on one real iOS + one real Android device
- [ ] Privacy policy URL live and reachable
- [ ] Data Safety (Play) + Privacy Nutrition Label (App Store) filled
- [ ] Test accounts created and verified, credentials in review notes
- [ ] Listing assets (icon, screenshots, copy ar+en) uploaded
- [ ] No secrets in the mobile repo — verified by the Phase 6 final-verification grep
