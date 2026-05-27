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
}
