import 'package:core/core_domain.dart';

import '../entities/catalog_enums.dart';
import '../entities/unit.dart';
import '../repositories/catalog_repository.dart';

class GetUnitsParams {
  const GetUnitsParams({
    this.projectId,
    this.status,
    this.priceMin,
    this.priceMax,
    this.areaMin,
    this.areaMax,
    this.bedrooms,
    this.sort = UnitSort.newest,
    this.page = 1,
    this.pageSize = 12,
  });

  final String? projectId;
  final UnitStatus? status;
  final num? priceMin;
  final num? priceMax;
  final num? areaMin;
  final num? areaMax;
  final int? bedrooms;
  final UnitSort sort;
  final int page;
  final int pageSize;
}

/// Returns a page of units matching the given filters/sort.
class GetUnits implements UseCase<Paginated<Unit>, GetUnitsParams> {
  const GetUnits(this._repo);
  final CatalogRepository _repo;

  @override
  Future<Result<Paginated<Unit>>> call(GetUnitsParams params) {
    return _repo.listUnits(
      projectId: params.projectId,
      status: params.status,
      priceMin: params.priceMin,
      priceMax: params.priceMax,
      areaMin: params.areaMin,
      areaMax: params.areaMax,
      bedrooms: params.bedrooms,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    );
  }
}
