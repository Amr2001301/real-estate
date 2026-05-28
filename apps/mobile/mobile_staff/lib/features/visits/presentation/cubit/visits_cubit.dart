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
  });

  final DataStatus status;
  final List<Visit> visits;
  final AppFailure? failure;
  final String? statusFilter;
  final bool today;

  VisitsListState copyWith({
    DataStatus? status,
    List<Visit>? visits,
    AppFailure? failure,
    String? statusFilter,
    bool clearStatusFilter = false,
    bool? today,
  }) =>
      VisitsListState(
        status: status ?? this.status,
        visits: visits ?? this.visits,
        failure: failure ?? this.failure,
        statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
        today: today ?? this.today,
      );

  @override
  List<Object?> get props => [status, visits, failure, statusFilter, today];
}

class VisitsCubit extends Cubit<VisitsListState> {
  VisitsCubit(this._getVisits, {bool today = false})
      : super(VisitsListState(today: today));

  final GetVisits _getVisits;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getVisits(
      VisitsQuery(status: state.statusFilter, today: state.today),
    );
    result.when(
      ok: (visits) => emit(state.copyWith(
        status: visits.isEmpty ? DataStatus.empty : DataStatus.success,
        visits: visits,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
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
