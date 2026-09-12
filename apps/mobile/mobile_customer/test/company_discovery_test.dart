import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/company_discovery/data/datasources/company_discovery_remote_data_source.dart';
import 'package:mobile_customer/features/company_discovery/data/dtos/company_discovery_dtos.dart';
import 'package:mobile_customer/features/company_discovery/data/repositories/company_discovery_repository_impl.dart';
import 'package:mobile_customer/features/company_discovery/domain/entities/discovered_company.dart';
import 'package:mobile_customer/features/company_discovery/domain/repositories/company_discovery_repository.dart';
import 'package:mobile_customer/features/company_discovery/domain/usecases/resolve_company.dart';
import 'package:mobile_customer/features/company_discovery/domain/usecases/search_companies.dart';

// ── Fakes ─────────────────────────────────────────────────────────────────────

class _FakeDataSource implements CompanyDiscoveryRemoteDataSource {
  _FakeDataSource({this.searchRows = const [], this.resolveRow, this.error});

  final List<DiscoveredCompanyDto> searchRows;
  final DiscoveredCompanyDto? resolveRow;
  final DioException? error;

  @override
  Future<List<DiscoveredCompanyDto>> search(String query) async {
    if (error != null) throw error!;
    return searchRows;
  }

  @override
  Future<DiscoveredCompanyDto?> resolveBySlug(String slug) async {
    if (error != null) throw error!;
    return resolveRow;
  }
}

class _FakeRepo implements CompanyDiscoveryRepository {
  _FakeRepo({required this.searchResult, required this.resolveResult});
  final Result<List<DiscoveredCompany>> searchResult;
  final Result<DiscoveredCompany?> resolveResult;

  @override
  Future<Result<List<DiscoveredCompany>>> search(String query) async => searchResult;

  @override
  Future<Result<DiscoveredCompany?>> resolveBySlug(String slug) async => resolveResult;
}

DioException _dio500() => DioException(
      requestOptions: RequestOptions(path: ''),
      response: Response(
        requestOptions: RequestOptions(path: ''),
        statusCode: 500,
      ),
      type: DioExceptionType.badResponse,
    );

AppFailure _networkFailure() => AppFailure(type: FailureType.network);

// ── DTO tests ─────────────────────────────────────────────────────────────────

void main() {
  group('DiscoveredCompanyDto', () {
    test('fromJson maps slug and name', () {
      final dto = DiscoveredCompanyDto.fromJson({'slug': 'acme', 'name': 'Acme Dev'});
      expect(dto.slug, 'acme');
      expect(dto.name, 'Acme Dev');
    });

    test('toDomain returns correct entity', () {
      final entity =
          DiscoveredCompanyDto.fromJson({'slug': 'acme', 'name': 'Acme Dev'}).toDomain();
      expect(entity, const DiscoveredCompany(slug: 'acme', name: 'Acme Dev'));
    });

    test('no companyId in entity props', () {
      final json = {'slug': 'acme', 'name': 'Acme Dev', 'companyId': 'ignored'};
      final entity = DiscoveredCompanyDto.fromJson(json).toDomain();
      expect(entity.props, ['acme', 'Acme Dev']);
    });
  });

  // ── Repository ───────────────────────────────────────────────────────────

  group('CompanyDiscoveryRepositoryImpl.search', () {
    test('maps DTOs to domain entities', () async {
      final ds = _FakeDataSource(searchRows: [
        DiscoveredCompanyDto.fromJson({'slug': 'alpha', 'name': 'Alpha'}),
        DiscoveredCompanyDto.fromJson({'slug': 'beta', 'name': 'Beta'}),
      ]);
      final result = await CompanyDiscoveryRepositoryImpl(ds).search('al');
      expect(result.isOk, isTrue);
      final companies = result.dataOrNull!;
      expect(companies.length, 2);
      expect(companies.first.slug, 'alpha');
    });

    test('returns empty list when no results', () async {
      final result = await CompanyDiscoveryRepositoryImpl(_FakeDataSource()).search('xyz');
      expect(result.dataOrNull, isEmpty);
    });

    test('propagates network error as Err', () async {
      final result =
          await CompanyDiscoveryRepositoryImpl(_FakeDataSource(error: _dio500())).search('alpha');
      expect(result.isErr, isTrue);
    });
  });

  group('CompanyDiscoveryRepositoryImpl.resolveBySlug', () {
    test('returns entity when found', () async {
      final ds = _FakeDataSource(
        resolveRow: DiscoveredCompanyDto.fromJson({'slug': 'acme', 'name': 'Acme'}),
      );
      final result = await CompanyDiscoveryRepositoryImpl(ds).resolveBySlug('acme');
      expect(result.isOk, isTrue);
      expect(result.dataOrNull?.slug, 'acme');
    });

    test('returns null when datasource returns null (404 absorbed by datasource)', () async {
      final result =
          await CompanyDiscoveryRepositoryImpl(_FakeDataSource(resolveRow: null)).resolveBySlug('ghost');
      expect(result.isOk, isTrue);
      expect(result.dataOrNull, isNull);
    });

    test('propagates non-404 network errors as Err', () async {
      final result =
          await CompanyDiscoveryRepositoryImpl(_FakeDataSource(error: _dio500())).resolveBySlug('acme');
      expect(result.isErr, isTrue);
    });
  });

  // ── Use cases ─────────────────────────────────────────────────────────────

  group('SearchCompanies use case', () {
    test('returns companies from repository', () async {
      const companies = [DiscoveredCompany(slug: 'a', name: 'A')];
      final result = await SearchCompanies(
        _FakeRepo(searchResult: Result.ok(companies), resolveResult: Result.ok(null)),
      )('alpha');
      expect(result.dataOrNull, companies);
    });

    test('propagates Err from repository', () async {
      final result = await SearchCompanies(
        _FakeRepo(searchResult: Result.err(_networkFailure()), resolveResult: Result.ok(null)),
      )('alpha');
      expect(result.isErr, isTrue);
    });
  });

  group('ResolveCompany use case', () {
    test('returns company when found', () async {
      const company = DiscoveredCompany(slug: 'acme', name: 'Acme');
      final result = await ResolveCompany(
        _FakeRepo(searchResult: Result.ok([]), resolveResult: Result.ok(company)),
      )('acme');
      expect(result.dataOrNull, company);
    });

    test('returns null when not found', () async {
      final result = await ResolveCompany(
        _FakeRepo(searchResult: Result.ok([]), resolveResult: Result.ok(null)),
      )('ghost');
      expect(result.isOk, isTrue);
      expect(result.dataOrNull, isNull);
    });
  });

  // ── DiscoveredCompany entity equality ─────────────────────────────────────

  group('DiscoveredCompany Equatable', () {
    test('equal when slug+name match', () {
      const a = DiscoveredCompany(slug: 'x', name: 'X');
      const b = DiscoveredCompany(slug: 'x', name: 'X');
      expect(a, b);
    });

    test('not equal when slug differs', () {
      const a = DiscoveredCompany(slug: 'x', name: 'X');
      const b = DiscoveredCompany(slug: 'y', name: 'X');
      expect(a, isNot(b));
    });
  });
}
