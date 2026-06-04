import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/unit.dart';
import '../../domain/usecases/get_units.dart';
import 'units_state.dart';

/// Drives a units listing. With [projectId] it lists that project's units;
/// with `null` it lists the global public catalog (used by the الوحدات tab).
class UnitsCubit extends Cubit<UnitsState> {
  UnitsCubit(this._getUnits, {this.projectId}) : super(const UnitsState()) {
    load();
  }

  final GetUnits _getUnits;
  final String? projectId;
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
      )),
      err: (failure) {
        AppLog.failure(failure);
        emit(state.copyWith(isLoadingMore: false, hasMore: false));
      },
    );
  }

  void applyFilter(UnitsFilter filter) {
    emit(state.copyWith(filter: filter));
    load();
  }

  Future<Result<Paginated<Unit>>> _fetch(int page) {
    final f = state.filter;
    return _getUnits(GetUnitsParams(
      projectId: projectId,
      status: f.status,
      priceMin: f.priceMin,
      priceMax: f.priceMax,
      areaMin: f.areaMin,
      areaMax: f.areaMax,
      bedrooms: f.bedrooms,
      sort: f.sort,
      page: page,
      pageSize: _pageSize,
    ));
  }
}
