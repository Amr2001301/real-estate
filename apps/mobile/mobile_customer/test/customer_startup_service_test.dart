import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/company_discovery/domain/entities/discovered_company.dart';
import 'package:mobile_customer/features/company_discovery/domain/repositories/company_discovery_repository.dart';
import 'package:mobile_customer/startup/customer_startup_service.dart';
import 'package:mobile_customer/storage/customer_tenant_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ── Fakes ─────────────────────────────────────────────────────────────────────

class _FakeRepo implements CompanyDiscoveryRepository {
  _FakeRepo({required this.resolveResult});
  final Result<DiscoveredCompany?> resolveResult;

  @override
  Future<Result<List<DiscoveredCompany>>> search(String query) async =>
      Result.ok([]);

  @override
  Future<Result<DiscoveredCompany?>> resolveBySlug(String slug) async =>
      resolveResult;
}

AppFailure _networkFailure() => AppFailure(type: FailureType.network);

class _CallCountRepo implements CompanyDiscoveryRepository {
  _CallCountRepo({required this.onResolve});
  final Result<DiscoveredCompany?> Function(String slug) onResolve;

  @override
  Future<Result<List<DiscoveredCompany>>> search(String query) async => Result.ok([]);

  @override
  Future<Result<DiscoveredCompany?>> resolveBySlug(String slug) async => onResolve(slug);
}

const _alpha = DiscoveredCompany(slug: 'alpha', name: 'Alpha Developers');

Future<CustomerTenantStorage> _makeStorage({String? slug, String? name}) async {
  final initial = <String, Object>{};
  if (slug != null) initial['customer.selectedCompanySlug'] = slug;
  if (name != null) initial['customer.selectedCompanyName'] = name;
  SharedPreferences.setMockInitialValues(initial);
  final prefs = await SharedPreferences.getInstance();
  return CustomerTenantStorage(prefs);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ── checkEligibility (K2 startup gate) ────────────────────────────────────
  //
  // These tests prove the structured-outcome API used by bootstrap.dart to gate
  // SessionCubit.restore() and by StartupRetryScreen for the retry flow.

  group('checkEligibility', () {
    test('§E1: no slug → TenantStartupOutcome.noSlug, nothing cleared', () async {
      final storage = await _makeStorage();
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(null)),
      );

      final outcome = await svc.checkEligibility();

      expect(outcome, TenantStartupOutcome.noSlug);
      expect(storage.hasSelectedCompany, isFalse);
    });

    test('§E2: slug present + resolve succeeds → valid, selection preserved', () async {
      final storage = await _makeStorage(slug: 'alpha', name: 'Alpha');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(_alpha)),
      );

      final outcome = await svc.checkEligibility();

      expect(outcome, TenantStartupOutcome.valid);
      expect(storage.selectedCompanySlug, 'alpha');
      expect(storage.hasSelectedCompany, isTrue);
    });

    test('§E3: resolve returns null (404/disabled) → unavailable + storage cleared', () async {
      final storage = await _makeStorage(slug: 'gone', name: 'Gone Co');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(null)),
      );

      final outcome = await svc.checkEligibility();

      expect(outcome, TenantStartupOutcome.unavailable);
      expect(storage.selectedCompanySlug, isNull);
      expect(storage.selectedCompanyName, isNull);
      expect(storage.hasSelectedCompany, isFalse);
    });

    test('§E4: network error → networkError, selection fully preserved', () async {
      final storage = await _makeStorage(slug: 'alpha', name: 'Alpha');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.err(_networkFailure())),
      );

      final outcome = await svc.checkEligibility();

      expect(outcome, TenantStartupOutcome.networkError);
      // Slug AND name must survive the network error — retry needs the slug.
      expect(storage.selectedCompanySlug, 'alpha');
      expect(storage.selectedCompanyName, 'Alpha');
      expect(storage.hasSelectedCompany, isTrue);
    });

    test('§E5: unavailable clear removes both keys (no residue)', () async {
      final storage = await _makeStorage(slug: 'ghost', name: 'Ghost Co');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(null)),
      );

      await svc.checkEligibility();

      expect(storage.selectedCompanySlug, isNull);
      expect(storage.selectedCompanyName, isNull);
    });

    test('§E6: retry after network error → valid on second call', () async {
      // Simulates the retry flow: first call fails, second succeeds.
      int callCount = 0;
      final storage = await _makeStorage(slug: 'alpha', name: 'Alpha');

      // Build a repo whose resolve alternates: first → Err, second → Ok
      final svc = CustomerStartupService(
        storage,
        _CallCountRepo(onResolve: (_) {
          callCount++;
          return callCount == 1
              ? Result.err(_networkFailure())
              : Result.ok(_alpha);
        }),
      );

      final first = await svc.checkEligibility();
      expect(first, TenantStartupOutcome.networkError);
      expect(storage.hasSelectedCompany, isTrue); // preserved

      final second = await svc.checkEligibility();
      expect(second, TenantStartupOutcome.valid);
      expect(storage.selectedCompanySlug, 'alpha'); // still preserved
    });
  });

  // ── Feature flag OFF (kEnableCustomerTenantSelection = false, production default) ──

  group('validateTenantSelection — flag OFF (production default)', () {
    test('returns null immediately even when a slug is persisted', () async {
      // Flag is a compile-time const false — the whole method short-circuits.
      final storage = await _makeStorage(slug: 'alpha', name: 'Alpha');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(_alpha)),
      );

      final result = await svc.validateTenantSelection();

      expect(result, isNull);
      expect(storage.selectedCompanySlug, 'alpha'); // untouched
    });

    test('returns null when no slug is persisted', () async {
      final storage = await _makeStorage();
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(null)),
      );
      expect(await svc.validateTenantSelection(), isNull);
    });
  });

  // ── Core revalidation logic (via validateWithFlagBypassed) ────────────────
  //
  // These tests prove the behavior that will run when kEnableCustomerTenantSelection
  // is flipped to true in K2. They call validateWithFlagBypassed() which skips
  // the const-false guard and exercises the resolve+clear path directly.

  group('validateWithFlagBypassed — revalidation logic', () {
    test('§R1: no slug persisted → null return, no resolve call', () async {
      final storage = await _makeStorage();
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(_alpha)),
      );
      expect(await svc.validateWithFlagBypassed(), isNull);
      expect(storage.hasSelectedCompany, isFalse);
    });

    test('§R2: slug present + resolve succeeds → keep selection, null return', () async {
      final storage = await _makeStorage(slug: 'alpha', name: 'Alpha');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(_alpha)),
      );

      final result = await svc.validateWithFlagBypassed();

      expect(result, isNull);
      expect(storage.selectedCompanySlug, 'alpha');
      expect(storage.selectedCompanyName, 'Alpha');
      expect(storage.hasSelectedCompany, isTrue);
    });

    test('§R3: slug present + resolve returns null (404) → clear storage + return selector route', () async {
      final storage = await _makeStorage(slug: 'alpha', name: 'Alpha');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(null)),
      );

      final result = await svc.validateWithFlagBypassed();

      expect(result, '/select-company?unavailable=true');
      expect(storage.selectedCompanySlug, isNull);
      expect(storage.selectedCompanyName, isNull);
      expect(storage.hasSelectedCompany, isFalse);
    });

    test('§R4: network error → preserve selection, null return (no clear)', () async {
      final storage = await _makeStorage(slug: 'alpha', name: 'Alpha');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.err(_networkFailure())),
      );

      final result = await svc.validateWithFlagBypassed();

      expect(result, isNull);
      expect(storage.selectedCompanySlug, 'alpha');
      expect(storage.hasSelectedCompany, isTrue);
    });

    test('§R5: after unavailable clear, both keys are null (no residue)', () async {
      final storage = await _makeStorage(slug: 'ghost', name: 'Ghost Co');
      final svc = CustomerStartupService(
        storage,
        _FakeRepo(resolveResult: Result.ok(null)),
      );

      await svc.validateWithFlagBypassed();

      expect(storage.selectedCompanySlug, isNull);
      expect(storage.selectedCompanyName, isNull);
      expect(storage.hasSelectedCompany, isFalse);
    });
  });
}
