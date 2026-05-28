import 'package:core/core_domain.dart';

import '../entities/staff_project.dart';
import '../repositories/staff_catalog_repository.dart';

class GetStaffProjects implements UseCase<List<StaffProject>, String?> {
  const GetStaffProjects(this._repo);
  final StaffCatalogRepository _repo;

  @override
  Future<Result<List<StaffProject>>> call(String? search) =>
      _repo.getProjects(search: search);
}

class GetStaffProjectDetail implements UseCase<StaffProjectDetail, String> {
  const GetStaffProjectDetail(this._repo);
  final StaffCatalogRepository _repo;

  @override
  Future<Result<StaffProjectDetail>> call(String id) => _repo.getProjectDetail(id);
}

class GetStaffUnitDetail implements UseCase<StaffUnit, String> {
  const GetStaffUnitDetail(this._repo);
  final StaffCatalogRepository _repo;

  @override
  Future<Result<StaffUnit>> call(String id) => _repo.getUnit(id);
}
