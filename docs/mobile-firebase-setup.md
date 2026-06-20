# Mobile Firebase Setup Guide

This guide covers creating Firebase projects, downloading real config files, and enabling FCM push notifications for both Flutter apps.

---

## Prerequisites

- Google account with access to [Firebase Console](https://console.firebase.google.com)
- Flutter SDK installed (`flutter --version`)
- `flutterfire_cli` installed: `dart pub global activate flutterfire_cli`
- Backend env vars ready (see Step 5)

---

## Step 1 — Create Firebase Projects

You need **two separate Firebase projects** (one per app), or one project with two apps registered.

**Recommended: two projects** (cleaner analytics separation):

| App | Suggested project name |
|-----|------------------------|
| Customer | `devora-customer` |
| Staff | `devora-staff` |

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it → disable Google Analytics (optional) → Create
3. Repeat for the second project

---

## Step 2 — Register Android & iOS Apps

For **each Firebase project**:

### Android

1. In Firebase Console → Project Overview → **Add app** → Android
2. Enter the Android package name:
   - Customer: `com.realestate.customer.mobile_customer`
   - Staff: `com.realestate.staff.mobile_staff`
3. (Optional) Enter SHA-1 fingerprint for debug: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
4. Download `google-services.json`
5. Replace the **placeholder** file:
   - Customer: `apps/mobile/mobile_customer/android/app/google-services.json`
   - Staff: `apps/mobile/mobile_staff/android/app/google-services.json`

### iOS

1. In Firebase Console → **Add app** → Apple (iOS+)
2. Enter the iOS bundle ID:
   - Customer: `com.realestate.customer.mobileCustomer`
   - Staff: `com.realestate.staff.mobileStaff`
3. Download `GoogleService-Info.plist`
4. Replace the **placeholder** file:
   - Customer: `apps/mobile/mobile_customer/ios/Runner/GoogleService-Info.plist`
   - Staff: `apps/mobile/mobile_staff/ios/Runner/GoogleService-Info.plist`

---

## Step 3 — Generate firebase_options.dart

Run this from each app directory. It regenerates `lib/firebase_options.dart` with real credentials:

```bash
# Customer app
cd apps/mobile/mobile_customer
flutterfire configure --project=devora-customer

# Staff app
cd apps/mobile/mobile_staff
flutterfire configure --project=devora-staff
```

`flutterfire configure` will:
- Detect the package names from the Gradle/Xcode files
- Download the correct config files
- Generate `lib/firebase_options.dart` with `DefaultFirebaseOptions.currentPlatform`

The generated file **replaces** the stub `firebase_options.dart` that currently throws `UnsupportedError`.

---

## Step 4 — iOS APNs Setup (required for iOS push)

FCM on iOS requires an APNs key or certificate.

1. Go to [Apple Developer Portal](https://developer.apple.com) → Certificates, Identifiers & Profiles → Keys
2. Create a new key → enable **Apple Push Notifications service (APNs)**
3. Download the `.p8` key file (save the Key ID and Team ID)
4. In Firebase Console → Project Settings → Cloud Messaging → Apple app configuration
5. Upload the `.p8` key, enter Key ID and Team ID

---

## Step 5 — Backend Firebase Admin SDK

The backend needs a service account to send FCM messages.

1. Firebase Console → Project Settings → Service accounts
2. Click **Generate new private key** → download JSON
3. From the JSON, copy three values into `apps/api/.env`:

```env
FIREBASE_PROJECT_ID=devora-customer   # or devora-staff — pick either; backend sends to both
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@devora-customer.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...rest of key...\n-----END PRIVATE KEY-----\n"
```

> **Important:** In `.env`, the `FIREBASE_PRIVATE_KEY` value must have literal `\n` (not real newlines). Copy the `private_key` field from the JSON and replace real newlines with `\n`.

Once set, restart the API. The `FirebaseService` will initialize and `pushEnabled` will return `true`.

---

## Step 6 — iOS Capability (Xcode)

1. Open `apps/mobile/mobile_customer/ios/Runner.xcworkspace` in Xcode
2. Select **Runner** target → Signing & Capabilities
3. Click **+** → add **Push Notifications**
4. Also add **Background Modes** → check **Remote notifications**
5. Repeat for `mobile_staff`

---

## Step 7 — Verify on Device

Push notifications require a **real device** (not simulator).

1. Build and install on a physical device
2. Launch the app → grant notification permission when prompted
3. Check backend logs for: `[PushService] Registered token for user xxx`
4. Send a test notification from Firebase Console → Cloud Messaging → **Send test message**
   - Enter the FCM token from the backend logs

---

## Step 8 — Enable PUSH Channel in Admin

Once the backend has `FIREBASE_*` env vars set:

1. Restart the API
2. In admin dashboard → Notifications → Broadcast
3. Select channel **PUSH** — the warning banner should disappear
4. Click **تقدير المستقبلين** to confirm recipients resolve
5. Send a test broadcast

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| App crashes on launch | `firebase_options.dart` still has stub | Run `flutterfire configure` |
| No token registered | Firebase initialized but APNs not configured (iOS) | Add APNs key in Firebase Console |
| `messaging/registration-token-not-registered` in backend logs | Stale token (user reinstalled app) | Expected — backend auto-prunes these tokens |
| PUSH channel shows warning in admin | `FIREBASE_*` env vars not set | Set and restart the API |
| Push arrives but tapping does nothing | `entityType`/`entityId` missing in notification payload | Check `fcm_route_resolver.dart` mapping |

---

## Files Summary

| File | Status | Action needed |
|------|--------|---------------|
| `mobile_customer/android/app/google-services.json` | Placeholder | Replace with real file from Firebase Console |
| `mobile_customer/ios/Runner/GoogleService-Info.plist` | Placeholder | Replace with real file from Firebase Console |
| `mobile_customer/lib/firebase_options.dart` | Stub (throws) | Run `flutterfire configure` to regenerate |
| `mobile_staff/android/app/google-services.json` | Placeholder | Replace with real file from Firebase Console |
| `mobile_staff/ios/Runner/GoogleService-Info.plist` | Placeholder | Replace with real file from Firebase Console |
| `mobile_staff/lib/firebase_options.dart` | Stub (throws) | Run `flutterfire configure` to regenerate |
| `apps/api/.env` | Missing `FIREBASE_*` vars | Add service account credentials |
