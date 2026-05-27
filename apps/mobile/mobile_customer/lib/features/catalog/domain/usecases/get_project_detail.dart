import 'package:core/core_domain.dart';

import '../entities/project.dart';
import '../repositories/catalog_repository.dart';

/// Returns a single project's detail by id.
class GetProjectDetail implements UseCase<ProjectDetail, String> {
  const GetProjectDetail(this._repo);
  final CatalogRepository _repo;

  @override
  Future<Result<ProjectDetail>> call(String id) => _repo.getProject(id);
}
