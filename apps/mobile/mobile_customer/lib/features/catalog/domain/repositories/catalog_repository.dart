import 'package:core/core_domain.dart';

import '../entities/catalog_enums.dart';
import '../entities/project.dart';
import '../entities/unit.dart';

/// Domain contract for catalog reads. Returns [Result] with [AppFailure] —
/// never raw exceptions. Pure Dart; the data layer implements it.
abstract interface class CatalogRepository {
  Future<Result<Paginated<ProjectListItem>>> listProjects({
    String? query,
    String? city,
    bool? featured,
    ProjectSort sort,
    int page,
    int pageSize,
  });

  Future<Result<ProjectDetail>> getProject(String id);

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
    UnitSort sort,
    int page,
    int pageSize,
  });

  Future<Result<Unit>> getUnit(String id);
}
