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
    // With a list already on screen (a filter or search changed) keep it there
    // and mark the reload, instead of swapping the page for a skeleton.
    final keepItems = state.status == DataStatus.success && state.items.isNotEmpty;
    emit(keepItems
        ? state.copyWith(isRefreshing: true, page: 1)
        : state.copyWith(status: DataStatus.loading, page: 1));
    final result = await _fetch(1);
    result.when(
      ok: (page) => emit(state.copyWith(
        status: page.data.isEmpty ? DataStatus.empty : DataStatus.success,
        items: page.data,
        page: 1,
        hasMore: page.hasMore,
        isRefreshing: false,
        // The city chips are the cities seen so far, not only those of the
        // current result: filtering to one city must not make the others vanish.
        knownCities: _mergeCities(state.knownCities, page.data),
        cityCounts: _mergeCounts(state.cityCounts, page.data),
      )),
      err: (failure) =>
          emit(state.copyWith(status: DataStatus.failure, failure: failure, isRefreshing: false)),
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

  /// The most projects seen in one city so far (each load only sees a page, so the max is the best estimate).
  Map<String, int> _mergeCounts(Map<String, int> current, List<ProjectListItem> items) {
    final seen = <String, int>{};
    for (final p in items) {
      if (p.city.isNotEmpty) seen[p.city] = (seen[p.city] ?? 0) + 1;
    }
    return {
      for (final c in {...current.keys, ...seen.keys}) c: (seen[c] ?? 0) > (current[c] ?? 0) ? seen[c]! : (current[c] ?? 0),
    };
  }

  List<String> _mergeCities(List<String> current, List<ProjectListItem> items) {
    final set = {...current, ...items.map((p) => p.city).where((c) => c.isNotEmpty)};
    return set.toList()..sort();
  }
}
