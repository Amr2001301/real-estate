import 'package:bloc_test/bloc_test.dart';
import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/company_discovery/domain/entities/discovered_company.dart';
import 'package:mobile_customer/features/company_discovery/domain/repositories/company_discovery_repository.dart';
import 'package:mobile_customer/features/company_discovery/domain/usecases/resolve_company.dart';
import 'package:mobile_customer/features/company_discovery/domain/usecases/search_companies.dart';
import 'package:mobile_customer/features/company_discovery/presentation/cubit/company_discovery_cubit.dart';
import 'package:mobile_customer/features/company_discovery/presentation/cubit/company_discovery_state.dart';

// ── Fake repository ───────────────────────────────────────────────────────────

class _FakeRepo implements CompanyDiscoveryRepository {
  _FakeRepo({required this.searchResult, required this.resolveResult});
  final Result<List<DiscoveredCompany>> searchResult;
  final Result<DiscoveredCompany?> resolveResult;

  @override
  Future<Result<List<DiscoveredCompany>>> search(String query) async => searchResult;

  @override
  Future<Result<DiscoveredCompany?>> resolveBySlug(String slug) async => resolveResult;
}

AppFailure _failure() => AppFailure(type: FailureType.network);

const _alpha = DiscoveredCompany(slug: 'alpha', name: 'Alpha Developers');
const _beta = DiscoveredCompany(slug: 'beta', name: 'Beta Realty');

CompanyDiscoveryCubit _cubit({
  Result<List<DiscoveredCompany>>? searchResult,
  Result<DiscoveredCompany?>? resolveResult,
}) {
  final repo = _FakeRepo(
    searchResult: searchResult ?? Result.ok([_alpha, _beta]),
    resolveResult: resolveResult ?? Result.ok(_alpha),
  );
  return CompanyDiscoveryCubit(
    searchCompanies: SearchCompanies(repo),
    resolveCompany: ResolveCompany(repo),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('CompanyDiscoveryCubit initial state', () {
    test('starts with status=initial, empty query and results', () {
      final cubit = _cubit();
      expect(cubit.state.status, CompanyDiscoveryStatus.initial);
      expect(cubit.state.query, '');
      expect(cubit.state.results, isEmpty);
      expect(cubit.state.failure, isNull);
    });
  });

  group('onQueryChanged — short query', () {
    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'query < 2 chars clears results, does NOT search',
      build: () => _cubit(),
      act: (c) => c.onQueryChanged('a'),
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.query, 'query', 'a')
            .having((s) => s.results, 'results', isEmpty)
            .having((s) => s.isSearching, 'isSearching', isFalse),
      ],
    );

    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'empty string does not trigger search',
      build: () => _cubit(),
      act: (c) => c.onQueryChanged(''),
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.query, 'query', '')
            .having((s) => s.isSearching, 'isSearching', isFalse),
      ],
    );
  });

  group('onQueryChanged — successful search', () {
    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'query ≥ 2 chars: emits query-update, searching, then idle with results',
      build: () => _cubit(searchResult: Result.ok([_alpha])),
      act: (c) => c.onQueryChanged('al'),
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.query, 'query', 'al')
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.initial),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.searching),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.idle)
            .having((s) => s.results, 'results', [_alpha])
            .having((s) => s.failure, 'failure', isNull),
      ],
    );

    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'empty search results surface as idle with empty list',
      build: () => _cubit(searchResult: Result.ok([])),
      act: (c) => c.onQueryChanged('xyz'),
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.query, 'query', 'xyz')
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.initial),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.searching),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.idle)
            .having((s) => s.results, 'results', isEmpty),
      ],
    );
  });

  group('onQueryChanged — search failure', () {
    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'network error surfaces as error status with failure set',
      build: () => _cubit(searchResult: Result.err(_failure())),
      act: (c) => c.onQueryChanged('al'),
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.query, 'query', 'al')
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.initial),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.searching),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.error)
            .having((s) => s.failure, 'failure', isNotNull)
            .having((s) => s.results, 'results', isEmpty),
      ],
    );
  });

  group('selectCompany', () {
    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'resolves OK → emits selecting then idle, returns company',
      build: () => _cubit(resolveResult: Result.ok(_alpha)),
      act: (c) async {
        final company = await c.selectCompany('alpha');
        expect(company, _alpha);
      },
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.selecting),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.idle),
      ],
    );

    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'resolve returns null (company unavailable) → error status, returns null',
      build: () => _cubit(resolveResult: Result.ok(null)),
      act: (c) async {
        final company = await c.selectCompany('ghost');
        expect(company, isNull);
      },
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.selecting),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.error),
      ],
    );

    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'resolve network failure → error status with failure, returns null',
      build: () => _cubit(resolveResult: Result.err(_failure())),
      act: (c) async {
        final company = await c.selectCompany('alpha');
        expect(company, isNull);
      },
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.selecting),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.error)
            .having((s) => s.failure, 'failure', isNotNull),
      ],
    );
  });

  group('clearError', () {
    blocTest<CompanyDiscoveryCubit, CompanyDiscoveryState>(
      'resets to idle with no failure',
      build: () => _cubit(searchResult: Result.err(_failure())),
      act: (c) async {
        c.onQueryChanged('al');
        await Future<void>.delayed(Duration.zero); // let _doSearch microtask settle
        c.clearError();
      },
      expect: () => [
        isA<CompanyDiscoveryState>()
            .having((s) => s.query, 'query', 'al')
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.initial),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.searching),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.error),
        isA<CompanyDiscoveryState>()
            .having((s) => s.status, 'status', CompanyDiscoveryStatus.idle)
            .having((s) => s.failure, 'failure', isNull),
      ],
    );
  });

  group('CompanyDiscoveryState helpers', () {
    test('isSearching only when searching', () {
      const s = CompanyDiscoveryState(status: CompanyDiscoveryStatus.searching);
      expect(s.isSearching, isTrue);
      expect(s.isSelecting, isFalse);
      expect(s.hasError, isFalse);
    });

    test('isSelecting only when selecting', () {
      const s = CompanyDiscoveryState(status: CompanyDiscoveryStatus.selecting);
      expect(s.isSelecting, isTrue);
      expect(s.isSearching, isFalse);
    });

    test('hasError only when error', () {
      const s = CompanyDiscoveryState(status: CompanyDiscoveryStatus.error);
      expect(s.hasError, isTrue);
    });
  });
}
