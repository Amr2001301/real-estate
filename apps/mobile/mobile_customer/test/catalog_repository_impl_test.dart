import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/data/datasources/catalog_remote_data_source.dart';
import 'package:mobile_customer/features/catalog/data/dtos/project_dto.dart';
import 'package:mobile_customer/features/catalog/data/dtos/unit_dto.dart';
import 'package:mobile_customer/features/catalog/data/repositories/catalog_repository_impl.dart';

/// Fake data source that throws a configurable [DioException] to verify the
/// repository's error mapping, or returns a canned page on success.
class _FakeDataSource implements CatalogRemoteDataSource {
  _FakeDataSource({this.error});
  final DioException? error;

  Never _throw() => throw error!;

  @override
  Future<Paginated<ProjectListItemDto>> listProjects(Map<String, dynamic> q) async {
    if (error != null) _throw();
    return const Paginated(
      data: [],
      meta: PageMeta(page: 1, pageSize: 12, total: 0, totalPages: 1),
    );
  }

  @override
  Future<ProjectDetailDto> getProject(String id) async => _throw();

  @override
  Future<Paginated<UnitDto>> listUnits(Map<String, dynamic> q) async => _throw();

  @override
  Future<UnitDto> getUnit(String id) async => _throw();

  @override
  Future<List<Map<String, dynamic>>> getUnitPlans(String unitId) async {
    if (error != null) _throw();
    return [
      {
        'name': 'Plan A',
        'isCash': false,
        'netPrice': 1000000,
        'reservationAmount': 50000,
        'downPaymentAmount': 50000,
        'discountAmount': 0,
        'finalPaymentAmount': 0,
        'options': [
          {'durationMonths': 60, 'frequency': 'MONTHLY', 'installmentsCount': 60, 'installmentAmount': 15000, 'totalPayable': 1000000},
          {'durationMonths': 24, 'frequency': 'QUARTERLY', 'installmentsCount': 8, 'installmentAmount': 112500, 'totalPayable': 1000000},
        ],
      },
    ];
  }

  @override
  Future<Map<String, dynamic>> getProjectPlans(String projectId) async {
    if (error != null) _throw();
    return {
      'plansCount': 2,
      'minDownPaymentPercent': 10,
      'maxMonths': 96,
      'offers': [
        {'downPaymentPercent': 10, 'maxMonths': 96, 'isCash': false},
        {'downPaymentPercent': 12.5, 'maxMonths': 24, 'isCash': false},
      ],
    };
  }
}

DioException _http(int status) => DioException(
      requestOptions: RequestOptions(path: '/public/projects'),
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: RequestOptions(path: '/public/projects'),
        statusCode: status,
      ),
    );

void main() {
  group('CatalogRepositoryImpl error mapping', () {
    test('404 → Err(AppFailure notFound), never throws', () async {
      final repo = CatalogRepositoryImpl(_FakeDataSource(error: _http(404)));
      final result = await repo.listProjects();
      expect(result.isErr, isTrue);
      expect(result.failureOrNull?.type, FailureType.notFound);
    });

    test('500 → Err(AppFailure server, retryable)', () async {
      final repo = CatalogRepositoryImpl(_FakeDataSource(error: _http(500)));
      final result = await repo.getProject('x');
      expect(result.failureOrNull?.type, FailureType.server);
      expect(result.failureOrNull?.isRetryable, isTrue);
    });

    test('connection error → Err(AppFailure network)', () async {
      final repo = CatalogRepositoryImpl(_FakeDataSource(
        error: DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: DioExceptionType.connectionError,
        ),
      ));
      final result = await repo.getUnit('x');
      expect(result.failureOrNull?.type, FailureType.network);
    });

    test('success path returns Ok with mapped entities', () async {
      final repo = CatalogRepositoryImpl(_FakeDataSource());
      final result = await repo.listProjects();
      expect(result.isOk, isTrue);
      expect(result.dataOrNull?.data, isEmpty);
    });
  });

  test('getUnitPlans reads the public plans into offers', () async {
    final repo = CatalogRepositoryImpl(_FakeDataSource());
    final result = await repo.getUnitPlans('u1');
    final offers = (result as Ok<List<InstallmentOffer>>).data;
    expect(offers, hasLength(1));
    final offer = offers.first;
    expect(offer.upfront, 100000);
    expect(offer.downPaymentPercent, 5);
    expect(offer.options.last.period, InstallmentPeriod.quarterly);
    expect(offer.longest!.durationMonths, 60);
    // 112,500 every 3 months is 37,500 a month: still dearer than 15,000.
    expect(offer.cheapest!.durationMonths, 60);
  });

  test('getProjectPlans reads the offers', () async {
    final repo = CatalogRepositoryImpl(_FakeDataSource());
    final result = await repo.getProjectPlans('p1');
    final summary = (result as Ok<ProjectPlanSummary>).data;
    expect(summary.minDownPaymentPercent, 10);
    expect(summary.maxMonths, 96);
    expect(summary.offers.last.downPaymentPercent, 12.5);
    expect(percentText(summary.offers.last.downPaymentPercent), '12.5');
  });

  test('getUnitPlans maps a network error to a failure', () async {
    final repo = CatalogRepositoryImpl(_FakeDataSource(error: _http(500)));
    expect(await repo.getUnitPlans('u1'), isA<Err<List<InstallmentOffer>>>());
  });
}
