import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/visit.dart';
import '../../domain/repositories/visits_repository.dart';
import '../../domain/usecases/visit_use_cases.dart';

class VisitsListState extends Equatable {
  const VisitsListState({
    this.status = DataStatus.initial,
    this.visits = const [],
    this.failure,
    this.statusFilter,
    this.today = false,
    this.page = 1,
    this.hasMore = false,
    this.isLoadingMore = false,
  });

  final DataStatus status;
  final List<Visit> visits;
  final AppFailure? failure;
  final String? statusFilter;
  final bool today;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;

  VisitsListState copyWith({
    DataStatus? status,
    List<Visit>? visits,
    AppFailure? failure,
    String? statusFilter,
    bool clearStatusFilter = false,
    bool? today,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
  }) =>
      VisitsListState(
        status: status ?? this.status,
        visits: visits ?? this.visits,
        failure: failure ?? this.failure,
        statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
        today: today ?? this.today,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      );

  @override
  List<Object?> get props =>
      [status, visits, failure, statusFilter, today, page, hasMore, isLoadingMore];
}

class VisitsCubit extends Cubit<VisitsListState> {
  VisitsCubit(this._getVisits, {bool today = false})
      : super(VisitsListState(today: today));

  final GetVisits _getVisits;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading, page: 1, hasMore: false));
    final result = await _getVisits(
      VisitsQuery(status: state.statusFilter, today: state.today, page: 1),
    );
    result.when(
      ok: (paged) => emit(state.copyWith(
        status: paged.data.isEmpty ? DataStatus.empty : DataStatus.success,
        visits: paged.data,
        page: 1,
        hasMore: paged.hasMore,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;
    final nextPage = state.page + 1;
    emit(state.copyWith(isLoadingMore: true));
    final result = await _getVisits(
      VisitsQuery(status: state.statusFilter, today: state.today, page: nextPage),
    );
    result.when(
      ok: (paged) => emit(state.copyWith(
        visits: [...state.visits, ...paged.data],
        page: nextPage,
        hasMore: paged.hasMore,
        isLoadingMore: false,
      )),
      err: (_) => emit(state.copyWith(isLoadingMore: false)),
    );
  }

  Future<void> setStatus(String? status) async {
    emit(status == null
        ? state.copyWith(clearStatusFilter: true)
        : state.copyWith(statusFilter: status));
    await load();
  }

  Future<void> toggleToday() async {
    emit(state.copyWith(today: !state.today));
    await load();
  }
}
