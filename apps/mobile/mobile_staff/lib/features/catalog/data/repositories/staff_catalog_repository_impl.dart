import 'package:core/core.dart';

import '../../domain/entities/staff_project.dart';
import '../../domain/repositories/staff_catalog_repository.dart';
import '../datasources/staff_catalog_remote_data_source.dart';
import '../mappers/staff_catalog_mapper.dart';

class StaffCatalogRepositoryImpl implements StaffCatalogRepository {
  StaffCatalogRepositoryImpl(this._remote);
  final StaffCatalogRemoteDataSource _remote;

  @override
  Future<Result<List<StaffProject>>> getProjects({String? search}) {
    return guardApiCall(() async {
      final rows = await _remote.listProjects(search: search);
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<StaffProjectDetail>> getProjectDetail(String id) {
    return guardApiCall(() async {
      final dto = await _remote.getProject(id);
      final units = await _remote.listUnits(projectId: id);
      return StaffProjectDetail(
        project: dto.toEntity(),
        description: dto.descriptionTranslatable,
        units: units.map((u) => u.toEntity()).toList(),
      );
    });
  }

  @override
  Future<Result<StaffUnit>> getUnit(String id) {
    return guardApiCall(() async => (await _remote.getUnit(id)).toEntity());
  }
}
