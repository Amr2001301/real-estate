# ADR 0001 — Mobile: Cubit/Bloc + Clean Architecture

- **Status:** Accepted (2026-05-27)
- **Scope:** `apps/mobile` (Customer & Staff Flutter apps)

## Context

The mobile apps must be maintainable by a team, testable without a backend, and
scale across many features (catalog, chat, and — later — authenticated client/
customer and staff features). Phase 2 shipped working features, but presentation
talked to a concrete repository that knew about Dio and used JSON models as if they
were entities. That couples UI to the wire format and makes testing/maintenance hard.

## Decision

### Why Cubit/Bloc (flutter_bloc)
- Predictable, stream-based state with first-class testability (`bloc_test`).
- **Cubit** for simple state (theme, locale, session, lists, filters, forms);
  **Bloc** only for event-driven flows with multiple events/side effects (chat now;
  later: file upload, maintenance lifecycle, multi-step auth). Riverpod is not used.

### Why Clean Architecture
- **Separation of concerns:** the wire format (DTOs) can change without touching UI;
  the UI can change without touching networking.
- **Testability:** domain (use cases) and data (mappers, repository error mapping)
  are pure-Dart unit-testable; cubits test against fake use cases — no Flutter/Dio.
- **Boundaries enforce safety:** errors are normalized to `AppFailure` at exactly one
  place (the repository impl via `guardApiCall`), so raw backend errors can never
  reach users.

### Layers & dependency direction
```
presentation ──▶ domain ◀── data
        (core / core_domain are leaf dependencies of all layers)
```
- **domain**: pure Dart — entities, repository contracts (`Result<Entity>`), use cases.
  Imports `package:core/core_domain.dart` only (Flutter-free, Dio-free).
- **data**: DTOs (`fromJson`), mappers (DTO→entity), data sources (Dio), repository
  impls (`guardApiCall` → `AppFailure`). The only layer that imports Dio.
- **presentation**: cubits/blocs depend on **use cases**; screens consume entities +
  `AppFailure`. No Dio/DTOs/repository-impl imports.

### core split
`core` keeps only shared, non-feature things: design system, shared widgets, network
client + interceptors, the `AppFailure`/`Result` error model + `guardApiCall`, the
`UseCase` base, generic `Paginated`/`Translatable`/`PriceFormatter`, auth/session
primitives, localization, theme/locale cubits, contact actions. It exposes two
entrypoints: `core.dart` (Flutter-facing) and **`core_domain.dart`** (pure-Dart subset
for domain layers, so domain never transitively imports Flutter).

### Feature granularity
A feature = a bounded context. `catalog`'s screens (home, projects, project details,
units, unit details, compare) are **presentation modules of one feature** because they
share entities + one repository — not six repositories. `chat` is its own feature.
`compare` is local UI state (a Cubit over domain entities; no use case needed).

### Dependency injection
- `core.buildAppRoot` provides shared services (Dio, TokenStorage) + global cubits.
- `app.dart` (composition root) provides the feature `*RepositoryImpl`s.
- The router constructs use cases from the repository contract and injects them into
  route-scoped cubits/blocs. Implementations are named only in DI, never in UI.

## Enforcement
Reviewed + greppable invariants (all currently passing):
- no `package:dio/dio.dart` in `*/presentation` or `*/domain`
- no DTO / data-source / `*_repository_impl` imports in `*/presentation` or `*/domain`
- no `package:flutter/*` and no `package:core/core.dart` in `*/domain`
- presentation never imports `*_repository_impl`
- cubits/blocs depend on use cases (constructor params), not data sources

## Consequences
- More files per feature, but each is small, single-purpose, and testable.
- Adding a feature follows a fixed recipe (see mobile README → "How to add a new
  feature"). Swapping hand-written DTOs for OpenAPI-generated ones later touches only
  the data layer.
- `dio` is now a direct dependency of the apps (data layer); `uuid` anonymous-id
  lifecycle moved into core `TokenStorage`.
