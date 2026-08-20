import 'package:core/core_domain.dart';

import '../entities/staff_project.dart';

abstract interface class StaffCatalogRepository {
  Future<Result<List<StaffProject>>> getProjects({String? search});
  Future<Result<StaffProjectDetail>> getProjectDetail(String id);
  Future<Result<List<StaffUnit>>> getProjectUnits(
    String projectId, {
    String? status,
    int? bedrooms,
    int? bathrooms,
    num? priceMin,
    num? priceMax,
    String? type,
  });
  Future<Result<StaffUnit>> getUnit(String id);
}
