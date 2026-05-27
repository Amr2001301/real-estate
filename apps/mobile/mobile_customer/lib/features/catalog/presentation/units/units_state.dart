import 'package:core/core.dart';

import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';

/// Active unit filters/sort for a project's units listing.
class UnitsFilter extends Equatable {
  const UnitsFilter({
    this.status,
    this.priceMin,
    this.priceMax,
    this.areaMin,
    this.areaMax,
    this.bedrooms,
    this.sort = UnitSort.newest,
  });

  final UnitStatus? status;
  final num? priceMin;
  final num? priceMax;
  final num? areaMin;
  final num? areaMax;
  final int? bedrooms;
  final UnitSort sort;

  UnitsFilter copyWith({
    UnitStatus? status,
    num? priceMin,
    num? priceMax,
    num? areaMin,
    num? areaMax,
    int? bedrooms,
    UnitSort? sort,
    bool clearStatus = false,
    bool clearBedrooms = false,
    bool clearPrice = false,
    bool clearArea = false,
  }) {
    return UnitsFilter(
      status: clearStatus ? null : (status ?? this.status),
      priceMin: clearPrice ? null : (priceMin ?? this.priceMin),
      priceMax: clearPrice ? null : (priceMax ?? this.priceMax),
      areaMin: clearArea ? null : (areaMin ?? this.areaMin),
      areaMax: clearArea ? null : (areaMax ?? this.areaMax),
      bedrooms: clearBedrooms ? null : (bedrooms ?? this.bedrooms),
      sort: sort ?? this.sort,
    );
  }

  int get activeCount =>
      (status != null ? 1 : 0) +
      (bedrooms != null ? 1 : 0) +
      (priceMin != null || priceMax != null ? 1 : 0) +
      (areaMin != null || areaMax != null ? 1 : 0);

  @override
  List<Object?> get props =>
      [status, priceMin, priceMax, areaMin, areaMax, bedrooms, sort];
}

class UnitsState extends Equatable {
  const UnitsState({
    this.status = DataStatus.initial,
    this.items = const [],
    this.failure,
    this.isLoadingMore = false,
    this.hasMore = false,
    this.page = 1,
    this.filter = const UnitsFilter(),
  });

  final DataStatus status;
  final List<Unit> items;
  final AppFailure? failure;
  final bool isLoadingMore;
  final bool hasMore;
  final int page;
  final UnitsFilter filter;

  UnitsState copyWith({
    DataStatus? status,
    List<Unit>? items,
    AppFailure? failure,
    bool? isLoadingMore,
    bool? hasMore,
    int? page,
    UnitsFilter? filter,
  }) {
    return UnitsState(
      status: status ?? this.status,
      items: items ?? this.items,
      failure: failure,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      filter: filter ?? this.filter,
    );
  }

  @override
  List<Object?> get props =>
      [status, items, failure, isLoadingMore, hasMore, page, filter];
}
