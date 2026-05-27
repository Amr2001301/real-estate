import 'package:core/core_domain.dart';

import '../entities/catalog_enums.dart';
import '../entities/project.dart';
import '../repositories/catalog_repository.dart';

class GetProjectsParams {
  const GetProjectsParams({
    this.query,
    this.city,
    this.featured,
    this.sort = ProjectSort.newest,
    this.page = 1,
    this.pageSize = 12,
  });

  final String? query;
  final String? city;
  final bool? featured;
  final ProjectSort sort;
  final int page;
  final int pageSize;
}

/// Returns a page of projects matching the given filters/search/sort.
class GetProjects implements UseCase<Paginated<ProjectListItem>, GetProjectsParams> {
  const GetProjects(this._repo);
  final CatalogRepository _repo;

  @override
  Future<Result<Paginated<ProjectListItem>>> call(GetProjectsParams params) {
    return _repo.listProjects(
      query: params.query,
      city: params.city,
      featured: params.featured,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    );
  }
}
