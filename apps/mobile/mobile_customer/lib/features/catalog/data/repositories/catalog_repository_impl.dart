import 'package:core/core.dart';

import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/project.dart';
import '../../domain/entities/unit.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../datasources/catalog_remote_data_source.dart';
import '../mappers/project_mapper.dart';
import '../mappers/unit_mapper.dart';

/// Coordinates the remote data source + DTO→entity mapping, and converts any
/// thrown error into an [AppFailure] via [guardApiCall].
class CatalogRepositoryImpl implements CatalogRepository {
  CatalogRepositoryImpl(this._remote);

  final CatalogRemoteDataSource _remote;

  @override
  Future<Result<Paginated<ProjectListItem>>> listProjects({
    String? query,
    String? city,
    bool? featured,
    ProjectSort sort = ProjectSort.newest,
    int page = 1,
    int pageSize = 12,
  }) {
    return guardApiCall(() async {
      final dtoPage = await _remote.listProjects({
        if (query != null && query.isNotEmpty) 'q': query,
        if (city != null && city.isNotEmpty) 'city': city,
        'featured': ?featured,
        'sort': sort.wire,
        'page': page,
        'pageSize': pageSize,
      });
      return dtoPage.map((dto) => dto.toEntity());
    });
  }

  @override
  Future<Result<ProjectDetail>> getProject(String id) {
    return guardApiCall(() async => (await _remote.getProject(id)).toEntity());
  }

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
  }) {
    return guardApiCall(() async {
      final dtoPage = await _remote.listUnits({
        'projectId': ?projectId,
        if (city != null && city.isNotEmpty) 'city': city,
        if (type != null && type.isNotEmpty) 'type': type,
        'status': ?status?.wire,
        'priceMin': ?priceMin,
        'priceMax': ?priceMax,
        'areaMin': ?areaMin,
        'areaMax': ?areaMax,
        'bedrooms': ?bedrooms,
        'sort': sort.wire,
        'page': page,
        'pageSize': pageSize,
      });
      return dtoPage.map((dto) => dto.toEntity());
    });
  }

  @override
  Future<Result<Unit>> getUnit(String id) {
    return guardApiCall(() async => (await _remote.getUnit(id)).toEntity());
  }
}
