import 'package:core/core.dart';

import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/project.dart';

/// Active project filters/search/sort.
class ProjectsFilter extends Equatable {
  const ProjectsFilter({
    this.query,
    this.city,
    this.featuredOnly = false,
    this.sort = ProjectSort.newest,
  });

  final String? query;
  final String? city;
  final bool featuredOnly;
  final ProjectSort sort;

  ProjectsFilter copyWith({
    String? query,
    String? city,
    bool? featuredOnly,
    ProjectSort? sort,
    bool clearCity = false,
    bool clearQuery = false,
  }) {
    return ProjectsFilter(
      query: clearQuery ? null : (query ?? this.query),
      city: clearCity ? null : (city ?? this.city),
      featuredOnly: featuredOnly ?? this.featuredOnly,
      sort: sort ?? this.sort,
    );
  }

  int get activeCount => (city != null ? 1 : 0) + (featuredOnly ? 1 : 0);

  @override
  List<Object?> get props => [query, city, featuredOnly, sort];
}

class ProjectsState extends Equatable {
  const ProjectsState({
    this.status = DataStatus.initial,
    this.items = const [],
    this.failure,
    this.isLoadingMore = false,
    this.hasMore = false,
    this.page = 1,
    this.filter = const ProjectsFilter(),
    this.knownCities = const [],
  });

  final DataStatus status;
  final List<ProjectListItem> items;
  final AppFailure? failure;
  final bool isLoadingMore;
  final bool hasMore;
  final int page;
  final ProjectsFilter filter;
  final List<String> knownCities;

  ProjectsState copyWith({
    DataStatus? status,
    List<ProjectListItem>? items,
    AppFailure? failure,
    bool? isLoadingMore,
    bool? hasMore,
    int? page,
    ProjectsFilter? filter,
    List<String>? knownCities,
  }) {
    return ProjectsState(
      status: status ?? this.status,
      items: items ?? this.items,
      failure: failure,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      filter: filter ?? this.filter,
      knownCities: knownCities ?? this.knownCities,
    );
  }

  @override
  List<Object?> get props =>
      [status, items, failure, isLoadingMore, hasMore, page, filter, knownCities];
}
