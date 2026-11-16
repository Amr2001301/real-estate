import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/domain/entities/catalog_enums.dart';
import 'package:mobile_customer/features/catalog/domain/entities/project.dart';
import 'package:mobile_customer/features/catalog/domain/entities/unit.dart';
import 'package:mobile_customer/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:mobile_customer/features/catalog/domain/usecases/get_projects.dart';
import 'package:mobile_customer/features/catalog/presentation/projects/projects_cubit.dart';

/// Lists projects in two cities and honours the `city` filter, like the API.
class _Repo implements CatalogRepository {
  final all = [_project('a', 'Riyadh'), _project('b', 'Jeddah'), _project('c', 'Riyadh')];

  @override
  Future<Result<Paginated<ProjectListItem>>> listProjects({
    String? query,
    String? city,
    bool? featured,
    ProjectSort sort = ProjectSort.newest,
    int page = 1,
    int pageSize = 12,
  }) async {
    await Future<void>.delayed(Duration.zero);
    final rows = all.where((p) => city == null || p.city == city).toList();
    return Result.ok(Paginated(
      data: rows,
      meta: PageMeta(page: 1, pageSize: 12, total: rows.length, totalPages: 1),
    ));
  }

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
  @override
  Future<Result<List<InstallmentOffer>>> getUnitPlans(String unitId) => throw UnimplementedError();
  @override
  Future<Result<ProjectPlanSummary>> getProjectPlans(String projectId) => throw UnimplementedError();
}

ProjectListItem _project(String id, String city) => ProjectListItem(
      id: id,
      name: const Translatable(ar: 'مشروع', en: 'Project'),
      description: const Translatable(ar: '', en: ''),
      city: city,
      services: const [],
      featured: false,
      availableUnitsCount: 1,
    );

void main() {
  group('ProjectsCubit filtering', () {
    test('the city chips survive filtering to one city', () async {
      final cubit = ProjectsCubit(GetProjects(_Repo()));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(cubit.state.knownCities, ['Jeddah', 'Riyadh']);

      cubit.applyFilter(cubit.state.filter.copyWith(city: 'Jeddah'));
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(cubit.state.items, hasLength(1));
      // Still both cities: the user can pick another one or go back to «الكل».
      expect(cubit.state.knownCities, ['Jeddah', 'Riyadh']);
    });

    test('cities are counted, so the chips can show the biggest first', () async {
      final cubit = ProjectsCubit(GetProjects(_Repo()));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(cubit.state.cityCounts, {'Riyadh': 2, 'Jeddah': 1});
      cubit.applyFilter(cubit.state.filter.copyWith(city: 'Jeddah'));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      // Filtering must not shrink the counts.
      expect(cubit.state.cityCounts, {'Riyadh': 2, 'Jeddah': 1});
    });

    test('a filter change keeps the list on screen while it reloads', () async {
      final cubit = ProjectsCubit(GetProjects(_Repo()));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(cubit.state.status, DataStatus.success);

      cubit.applyFilter(cubit.state.filter.copyWith(city: 'Jeddah'));
      // Not a skeleton: the previous items stay, flagged as refreshing.
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.items, hasLength(3));
      expect(cubit.state.isRefreshing, isTrue);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(cubit.state.isRefreshing, isFalse);
    });
  });
}
