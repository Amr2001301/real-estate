import 'package:flutter/foundation.dart';

import '../feature_flags.dart';
import '../features/company_discovery/domain/repositories/company_discovery_repository.dart';
import '../features/company_discovery/domain/usecases/resolve_company.dart';
import '../storage/customer_tenant_storage.dart';

/// Outcome of an exact tenant eligibility check at startup.
///
/// Used by [bootstrap.dart] (pre-widget-tree) to gate [SessionCubit.restore]
/// and by [StartupRetryScreen] for the retry flow.
enum TenantStartupOutcome {
  /// Company resolved, ACTIVE, customerAppEnabled=true. Session may restore.
  valid,

  /// Company not found (404), inactive, or customerAppEnabled=false.
  /// Slug and name cleared; tokens should be cleared; user must re-select.
  unavailable,

  /// Network or timeout error during resolve. Slug preserved; tokens preserved;
  /// session must NOT restore. Show retry/offline UI.
  networkError,

  /// No company slug is persisted. Session must not restore; orphaned tokens
  /// (if any) are cleared by [SessionCubit.restore].
  noSlug,
}

/// K1/K2 — Startup revalidation for the persisted customer tenant selection.
///
/// [validateTenantSelection] / [validateWithFlagBypassed] are called from
/// the post-frame callback in _CustomerRootState (legacy K1 path, UI-only).
///
/// [checkEligibility] is the K2 path: called from [bootstrap.dart] BEFORE
/// [buildAppRoot] and from [StartupRetryScreen] on retry. It returns a
/// structured [TenantStartupOutcome] that the bootstrap uses to gate
/// [SessionCubit.restore] and the router uses to show appropriate UI.
class CustomerStartupService {
  CustomerStartupService(this._storage, this._repo);

  final CustomerTenantStorage _storage;
  final CompanyDiscoveryRepository _repo;

  // ── Legacy K1 route-redirect API ───────────────────────────────────────────

  /// Returns a navigation route string if action is needed, null otherwise.
  /// Used by the post-frame UI redirect (K1 path; security gate is in K2).
  Future<String?> validateTenantSelection() async {
    if (!kEnableCustomerTenantSelection) return null;
    return _doValidate();
  }

  @visibleForTesting
  Future<String?> validateWithFlagBypassed() => _doValidate();

  Future<String?> _doValidate() async {
    if (!_storage.hasSelectedCompany) return null;

    final slug = _storage.selectedCompanySlug!;
    final result = await ResolveCompany(_repo)(slug);

    if (result.isErr) return null; // network error — preserve, don't block

    final company = result.dataOrNull;
    if (company == null) {
      await _storage.clearSelectedCompany();
      return '/select-company?unavailable=true';
    }

    return null;
  }

  // ── K2 eligibility API ─────────────────────────────────────────────────────

  /// Exact-resolves the persisted company slug against the backend and returns
  /// a structured [TenantStartupOutcome].
  ///
  /// On [TenantStartupOutcome.unavailable]: clears slug + name from storage.
  /// On [TenantStartupOutcome.networkError]: preserves all storage (retry later).
  ///
  /// Callers are responsible for gating [SessionCubit.restore] and clearing
  /// auth tokens based on the returned outcome.
  Future<TenantStartupOutcome> checkEligibility() async {
    if (!_storage.hasSelectedCompany) return TenantStartupOutcome.noSlug;

    final slug = _storage.selectedCompanySlug!;
    final result = await ResolveCompany(_repo)(slug);

    if (result.isErr) return TenantStartupOutcome.networkError;

    final company = result.dataOrNull;
    if (company == null) {
      await _storage.clearSelectedCompany();
      return TenantStartupOutcome.unavailable;
    }

    return TenantStartupOutcome.valid;
  }
}
