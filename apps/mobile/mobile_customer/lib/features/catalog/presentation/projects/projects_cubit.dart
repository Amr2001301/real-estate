import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/project.dart';
import '../../domain/usecases/get_projects.dart';
import 'projects_state.dart';

/// Drives the projects listing. Depends on the [GetProjects] use case only.
class ProjectsCubit extends Cubit<ProjectsState> {
  ProjectsCubit(this._getProjects, {ProjectsFilter? initialFilter})
      : super(ProjectsState(filter: initialFilter ?? const ProjectsFilter())) {
    load();
  }

  final GetProjects _getProjects;
  static const _pageSize = 12;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading, page: 1));
    final result = await _fetch(1);
    result.when(
      ok: (page) => emit(state.copyWith(
        status: page.data.isEmpty ? DataStatus.empty : DataStatus.success,
        items: page.data,
        page: 1,
        hasMore: page.hasMore,
        knownCities: _mergeCities(const [], page.data),
      )),
      err: (failure) =>
          emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> refresh() => load();

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore || state.status != DataStatus.success) {
      return;
    }
    emit(state.copyWith(isLoadingMore: true));
    final next = state.page + 1;
    final result = await _fetch(next);
    result.when(
      ok: (page) => emit(state.copyWith(
        items: [...state.items, ...page.data],
        page: next,
        hasMore: page.hasMore,
        isLoadingMore: false,
        knownCities: _mergeCities(state.knownCities, page.data),
      )),
      err: (failure) {
        AppLog.failure(failure);
        emit(state.copyWith(isLoadingMore: false, hasMore: false));
      },
    );
  }

  void applyFilter(ProjectsFilter filter) {
    emit(state.copyWith(filter: filter));
    load();
  }

  void search(String? query) {
    final trimmed = (query ?? '').trim();
    applyFilter(state.filter.copyWith(
      query: trimmed.isEmpty ? null : trimmed,
      clearQuery: trimmed.isEmpty,
    ));
  }

  Future<Result<Paginated<ProjectListItem>>> _fetch(int page) {
    final f = state.filter;
    return _getProjects(GetProjectsParams(
      query: f.query,
      city: f.city,
      featured: f.featuredOnly ? true : null,
      sort: f.sort,
      page: page,
      pageSize: _pageSize,
    ));
  }

  List<String> _mergeCities(List<String> current, List<ProjectListItem> items) {
    final set = {...current, ...items.map((p) => p.city).where((c) => c.isNotEmpty)};
    return set.toList()..sort();
  }
}
