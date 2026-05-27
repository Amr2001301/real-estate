import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/domain/entities/catalog_enums.dart';
import 'package:mobile_customer/features/catalog/domain/entities/project.dart';
import 'package:mobile_customer/features/catalog/domain/entities/unit.dart';
import 'package:mobile_customer/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:mobile_customer/features/catalog/domain/usecases/get_featured_projects.dart';
import 'package:mobile_customer/features/catalog/presentation/home/home_cubit.dart';

/// Fake repository returning canned results — lets us test use cases + cubits
/// without any network.
class _FakeCatalogRepository implements CatalogRepository {
  _FakeCatalogRepository(this._projectsResult);
  final Result<Paginated<ProjectListItem>> _projectsResult;

  @override
  Future<Result<Paginated<ProjectListItem>>> listProjects({
    String? query,
    String? city,
    bool? featured,
    ProjectSort sort = ProjectSort.newest,
    int page = 1,
    int pageSize = 12,
  }) async =>
      _projectsResult;

  @override
  Future<Result<ProjectDetail>> getProject(String id) => throw UnimplementedError();

  @override
  Future<Result<Paginated<Unit>>> listUnits({
    String? projectId,
    String? city,
    String? type,
    UnitStatus? status,
    num? priceMin,
    num? priceMax,
    num? areaMin,
    num? areaMax,
    int? bedrooms,
    UnitSort sort = UnitSort.newest,
    int page = 1,
    int pageSize = 12,
  }) =>
      throw UnimplementedError();

  @override
  Future<Result<Unit>> getUnit(String id) => throw UnimplementedError();
}

ProjectListItem _project(String id) => ProjectListItem(
      id: id,
      name: const Translatable(ar: 'مشروع', en: 'Project'),
      description: const Translatable(ar: '', en: ''),
      city: 'Cairo',
      services: const [],
      featured: true,
      availableUnitsCount: 3,
    );

Paginated<ProjectListItem> _page(List<ProjectListItem> items) => Paginated(
      data: items,
      meta: PageMeta(page: 1, pageSize: 8, total: items.length, totalPages: 1),
    );

void main() {
  group('GetFeaturedProjects use case', () {
    test('maps a successful page to a list of entities', () async {
      final repo = _FakeCatalogRepository(Result.ok(_page([_project('a')])));
      final result = await GetFeaturedProjects(repo)(const NoParams());
      expect(result.isOk, isTrue);
      expect(result.dataOrNull, hasLength(1));
    });

    test('propagates failures', () async {
      final repo = _FakeCatalogRepository(
        Result.err(AppFailure(type: FailureType.network)),
      );
      final result = await GetFeaturedProjects(repo)(const NoParams());
      expect(result.failureOrNull?.type, FailureType.network);
    });
  });

  group('HomeCubit', () {
    test('emits success with projects', () async {
      final repo = _FakeCatalogRepository(Result.ok(_page([_project('a')])));
      final cubit = HomeCubit(GetFeaturedProjects(repo));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data, hasLength(1));
    });

    test('emits empty when there are no projects', () async {
      final repo = _FakeCatalogRepository(Result.ok(_page(const [])));
      final cubit = HomeCubit(GetFeaturedProjects(repo));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('emits failure on error', () async {
      final repo = _FakeCatalogRepository(
        Result.err(AppFailure(type: FailureType.server)),
      );
      final cubit = HomeCubit(GetFeaturedProjects(repo));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
      expect(cubit.state.failure?.type, FailureType.server);
    });
  });
}
