import 'package:core/core_domain.dart';

import '../entities/catalog_enums.dart';
import '../entities/project.dart';
import '../repositories/catalog_repository.dart';

/// Returns the featured projects for the home screen.
class GetFeaturedProjects implements UseCase<List<ProjectListItem>, NoParams> {
  const GetFeaturedProjects(this._repo);
  final CatalogRepository _repo;

  @override
  Future<Result<List<ProjectListItem>>> call(NoParams params) async {
    final result = await _repo.listProjects(
      featured: true,
      sort: ProjectSort.newest,
      page: 1,
      pageSize: 8,
    );
    return result.map((page) => page.data);
  }
}
