import 'package:core/core_domain.dart';

import '../entities/staff_project.dart';

abstract interface class StaffCatalogRepository {
  Future<Result<List<StaffProject>>> getProjects({String? search});
  Future<Result<StaffProjectDetail>> getProjectDetail(String id);
  Future<Result<StaffUnit>> getUnit(String id);
}
