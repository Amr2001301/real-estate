# Real Estate — Mobile (Flutter)

Phase 0 + 1 foundation for the two mobile apps. **No business features yet** — this
is the shared spine (design system, theme, localization, network, auth, routing,
widgets) plus a component gallery to verify it.

| App | Audience | Status |
| --- | --- | --- |
| `mobile_customer` | Guest / Client / Customer | Shell + placeholders |
| `mobile_staff` | Sales / Broker | Shell + placeholders |
| `packages/core` | Shared foundation | Implemented |

> Admin stays on the web dashboard — there is no Admin mobile app (an "Admin Lite"
> for approvals may come later).

## Layout

```
apps/mobile/                     # Melos + Dart pub-workspace root (isolated from the JS monorepo)
├── pubspec.yaml                 # workspace members + Melos config (scripts under `melos:`)
├── analysis_options.yaml        # shared lints
├── packages/core/               # design system, theme, l10n, state, error handling, network, auth, widgets
├── mobile_customer/             # thin app: bootstrap + flavors + router + feature placeholders
└── mobile_staff/                # thin app: same shape
```

`core` exposes Flutter-facing things through `package:core/core.dart`, and a
**Flutter-free subset** for domain layers through `package:core/core_domain.dart`.

## Architecture — Clean Architecture

The apps follow Clean Architecture, organized **feature-first**. A "feature" is a
bounded context (e.g. `catalog`, `chat`); its screens are presentation modules that
share one domain + repository. Each feature has three layers:

```
features/<feature>/
├── data/
│   ├── datasources/   # raw API calls (Dio), return DTOs, may throw
│   ├── dtos/          # wire shapes (fromJson) — data layer only
│   ├── mappers/       # DTO → entity (explicit extensions)
│   └── repositories/  # *_repository_impl.dart: guardApiCall + map → Result<Entity>
├── domain/            # pure Dart (no Flutter, no Dio, no DTOs)
│   ├── entities/      # business types
│   ├── repositories/  # abstract contracts → Result<Entity> (AppFailure)
│   └── usecases/      # one operation each, implement core's UseCase<Out,In>
└── presentation/
    ├── cubit/ or bloc/ # depends on USE CASES only
    ├── screens/        # consume entities + AppFailure; never Dio/DTOs/repos
    └── widgets/
```

### Layer responsibilities
- **Presentation** — widgets + cubits/blocs. Cubits/Blocs depend on **use cases only**
  (never Dio, DTOs, endpoints, or raw responses). UI shows entities/view-state +
  `AppFailure` (localized); never raw backend errors.
- **Domain** — **pure Dart**. Entities, repository contracts (return
  `Result<Entity>` with `AppFailure`, never exceptions), and use cases. Imports
  `package:core/core_domain.dart` only.
- **Data** — the only layer that touches Dio/the API. DTOs (`fromJson`) live here and
  are mapped to entities by explicit mappers. `*RepositoryImpl` wraps calls in
  `guardApiCall` so every error becomes an `AppFailure`.

### Import rules (enforced by review + grep checks)
- domain → `core_domain` only. **No** Flutter, Dio, DTOs, or `package:core/core.dart`.
- presentation → domain (entities + use cases) + `core`. **No** Dio, DTOs, data sources,
  or `*RepositoryImpl`.
- data → domain + `core`. Owns Dio + DTOs.
- Dependency direction: `presentation → domain ← data`; `core`/`core_domain` are leaves.
  No circular dependencies.
- DI is the only place implementations are named: `app.dart` (composition root)
  constructs `*RepositoryImpl`; the router constructs use cases from the repository
  contract and injects them into cubits.

### How to add a new feature
1. `domain/`: entities → `repositories/<x>_repository.dart` (contract) → `usecases/`.
2. `data/`: `dtos/` + `mappers/` + `datasources/<x>_remote_data_source.dart` +
   `repositories/<x>_repository_impl.dart` (use `guardApiCall`).
3. `presentation/`: cubit/bloc taking use cases → screen (`StateView` + `AppFailure`).
4. DI: provide the repository impl in `app.dart`; build use cases in the route and pass
   to the cubit/bloc. Add localized strings; add mapper/use-case/cubit tests.

> Catalog data/domain currently live in `mobile_customer`. When the Staff App needs
> browsing (Phase 4), extract `catalog/domain` + `catalog/data` into a shared package.

## State management — flutter_bloc (Cubit/Bloc)

- **Cubit** is the default for simple state: `ThemeCubit`, `LocaleCubit`,
  `SessionCubit` (in `core`), and later: simple lists, filters, screen state, forms.
- **Bloc** (event-driven) is reserved for complex flows with multiple events/side
  effects: chat, file upload, maintenance lifecycle, multi-step auth, notifications.
- App-wide cubits + services (SharedPreferences, secure `TokenStorage`, `Dio`) are
  created once in the shared composition root `buildAppRoot(...)` and provided via
  `MultiBlocProvider` / `MultiRepositoryProvider`. Apps read them with
  `context.read<…>()` / `context.watch<…>()`.
- Shared base state lives in `core`: `DataState<T>` (`initial/loading/success/empty/
  failure`) + the `StateView` widget render it consistently.

## Error handling

All errors funnel into a single `AppFailure` (type, code, statusCode,
userMessageKey, technicalMessage, isRetryable, requestId, validationMessages).
Nothing technical is ever shown to users.

- `guardApiCall(() => dio…)` wraps API calls; `DioErrorMapper` converts every
  `DioException` → `AppFailure` (status → category; safe validation detail only).
- Localized messages (ar/en) resolve from `AppErrorMessageKey` via
  `failure.userMessage(l10n)`.
- **UI**: full-screen `ErrorState` for screen-load failures (retry only when
  `failure.isRetryable`); `EmptyState` is distinct from errors; inline field errors
  via `AppTextField.errorText`; `showFailureSnackBar(...)` for action-level failures;
  loading uses `AppSkeletonizer`, not bare spinners.
- **Logging**: `AppLog.failure(...)` logs the technical detail; swap
  `AppLog.reporter` for a Sentry/Crashlytics `ErrorReporter` later — no call sites change.

## Prerequisites

- Flutter ≥ 3.38 (Dart ≥ 3.10)
- Melos: `dart pub global activate melos`

## Install

```bash
cd apps/mobile
flutter pub get          # resolves the whole workspace into one lockfile
```

## Code generation

`core` uses freezed / json_serializable (Session, SessionState) and gen-l10n.
The apps need no codegen (plain cubits + GoRouter).

```bash
# from apps/mobile/packages/core
dart run build_runner build --delete-conflicting-outputs   # freezed / json
flutter gen-l10n                                            # ar/en localizations

# or across the workspace
melos run gen
melos run l10n
```

Generated files (`*.g.dart`, `*.freezed.dart`, `lib/src/l10n/generated/`) are committed
so a fresh checkout analyzes without a build step.

## Run

Each app has three flavor entrypoints (environment selected in code, no native
flavor setup required yet):

```bash
# Customer app
cd apps/mobile/mobile_customer
flutter run -t lib/main_dev.dart        # dev      (API http://localhost:4000/v1)
flutter run -t lib/main_staging.dart    # staging
flutter run -t lib/main_prod.dart       # prod

# Staff app
cd apps/mobile/mobile_staff
flutter run -t lib/main_dev.dart
```

Override the API base URL without editing code:

```bash
flutter run -t lib/main_dev.dart --dart-define=API_BASE_URL=http://192.168.1.10:4000/v1
```

A plain `flutter run` (default `lib/main.dart`) delegates to the dev flavor.

## Verifying the foundation

Open the **Component Gallery** from either app's home/dashboard ("Component Gallery"
button) or navigate to `/gallery`. It shows buttons, inputs, cards, badges, the
empty/error/retry states, and a skeleton-loading toggle. The app bar has two actions:

- **Translate icon** → toggles **Arabic (RTL) ⇄ English (LTR)** instantly.
- **Brightness icon** → cycles **System → Light → Dark**.

Both choices are **persisted** (via `shared_preferences`) and restored on next launch.
The demo **Login** buttons store a fake session in secure storage so you can see the
**auth route guards** redirect (Customer: account area is guarded; Staff: everything
is guarded and only staff roles reach the dashboard).

## Quality gates

```bash
cd apps/mobile
melos run analyze              # all packages
melos run test --no-select     # core tests: error mapping, localized messages, cubits, widgets
```

## Phase 2 — Customer App guest browse (implemented)

Public, anonymous catalog browsing for the Customer App:

- **Home** — hero + search entry, featured projects carousel, CTAs (explore / assistant), pull-to-refresh.
- **Projects listing** — search, filters (city / featured), sort, infinite scroll, pull-to-refresh.
- **Project details** — image gallery, about, amenities, location card (opens native Maps), units preview, CTAs.
- **Units listing** — per-project, filters (status / rooms / price / area ranges), sort, pagination.
- **Unit details** — gallery, specs, price, status, project reference, contact CTAs, add-to-compare, request-visit prompt (→ login/contact).
- **Compare** — local side-by-side of selected units (no batch endpoint exists; see API gaps).
- **Public AI Chat** — rule-based assistant: messages, quick replies, result cards, CTAs, missing-fields flow, typing indicator, error/retry. No provider key (none exists on any surface).

Data layer (`CatalogRepository`, `ChatRepository`, models) lives in `core`; cubits/screens are feature-first in `mobile_customer/lib/features/`. Cubits everywhere except **chat** (a Bloc). All screens use Skeletonizer loading, `AppFailure` errors, ar/en + RTL, light/dark, reduced-motion-aware animations.

> DTOs are hand-written and should be replaced by OpenAPI-generated models later.

## Phase 3A — Authenticated Client basics (implemented)

Feature-first clean stacks in `mobile_customer/lib/features/`: `auth`, `profile`,
`favorites`, `visits`, `notifications`.

- **Auth** — customer email login/register + **phone OTP** (request/verify) + logout +
  session restore. Tokens live only in secure storage. The `AuthRepositoryImpl` owns
  persistence; `AuthCubit` updates the app-wide `SessionCubit` via emit-only `adopt`.
- **401 → refresh → retry** — wired via a `SessionRefresherRegistry`: on 401 the Dio
  interceptor calls the auth repo's `refreshSession` (rotates tokens); on failure it
  clears storage + signs out → router redirects to login with a localized
  session-expired message. Tokens/technical details never logged or shown.
- **Route guards (role-aware)** — guest browses public catalog; `/account/**` requires an
  authenticated **customer-side** role (staff roles are bounced); `/visit-request`
  requires auth. Guest actions (favorite / request visit) prompt or redirect to login.
- **Profile** — view + edit (fullName / phone / locale) with inline validation + states.
- **Favorites** — app-wide `FavoritesCubit` (loads on sign-in), favorites screen, and a
  heart toggle on project/unit details (guest → login prompt).
- **Visits** — request-a-visit form (date + notes) from project/unit details, and a
  "My requests" list with localized status chips.
- **Notifications** — DB list + mark-read / mark-all-read. Title is derived client-side
  from `templateCode` (backend returns no resolved title/body — see backend gaps).
  Device registration is **scaffolded** (`RegisterDevice` use case) but not invoked —
  push delivery (FCM) is not wired backend-side.

**Deferred (gated):** My Property, deposits, contracts PDF, maintenance-with-documents,
and any financial/document screens — until the centralized ownership guard + signed
document-download endpoint are confirmed (and FCM for real push). Staff/Broker/Admin
remain out of this app.

## Phase 3B — Backend readiness + notifications hardening (implemented)

Backend (`apps/api`, 984 tests pass): FCM `FirebaseService` (safe no-op without creds) +
`PushService` wired into notification sends; notifications now return **localized
title/body** + **unread-count** + **pagination**; a centralized `OwnershipService`
(throws NotFound, no existence leak); **signed document downloads**
(`GET /me/documents/:id/download`, ownership + CUSTOMER_VISIBLE, short-lived signed URL);
OTP code never logged in production; `GET /me/favorites/ids`; `openapi:export` script.

Mobile: notifications consume the resolved title/body (with fallback), an app-wide
`UnreadCountCubit` drives an unread **badge** on the account hub, and device
registration is **scaffolded** behind a `PushTokenProvider` (no-op `NoopPushTokenProvider`)
invoked after login — **nothing faked**; plugging real FCM = one provider implementation
+ native Firebase config. See [docs/mobile-backend-readiness.md](../../docs/mobile-backend-readiness.md)
for the full status table and what still needs credentials.

## What's intentionally a placeholder (wired in later phases)

- **Login** screens use a demo sign-in. Real `/auth/*` (OTP + email) lands in Phase 3/4.
- `DioClient`'s 401→refresh→retry machinery is in place but its `SessionRefresher`
  is `null` until the auth phase wires `/auth/refresh`.
- Client/Customer authenticated features (favorites, visits, my property, etc.) and the
  Staff App features are **not** built yet (the Staff App still compiles — guest browse only).
- Embedded maps use an external Maps launch; in-app `google_maps_flutter` is deferred.
- Push notifications are **blocked on the backend** — see
  [docs/mobile-backend-readiness.md](../../docs/mobile-backend-readiness.md).

## Production notes

- **Fonts**: `google_fonts` fetches Inter / IBM Plex Sans Arabic / Tajawal at runtime
  and caches them. Before release, **bundle the licensed font files** into assets for
  offline guarantees and deterministic rendering.
- **Native flavors**: separate bundle IDs / signing / app icons per environment are a
  follow-up; today flavors are entrypoint + `--dart-define` based.
- **Lints**: only `flutter_lints` is enabled for now; bloc-specific lints can be
  added later if desired.
