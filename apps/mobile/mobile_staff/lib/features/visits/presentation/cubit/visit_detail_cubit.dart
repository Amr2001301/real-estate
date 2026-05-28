import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/visit.dart';
import '../../domain/usecases/visit_use_cases.dart';

class VisitDetailState extends Equatable {
  const VisitDetailState({
    this.status = DataStatus.initial,
    this.detail,
    this.failure,
    this.working = false,
    this.actionFailure,
  });

  final DataStatus status;
  final VisitDetail? detail;
  final AppFailure? failure;
  final bool working;
  final AppFailure? actionFailure;

  VisitDetailState copyWith({
    DataStatus? status,
    VisitDetail? detail,
    AppFailure? failure,
    bool? working,
    AppFailure? actionFailure,
    bool clearActionFailure = false,
  }) =>
      VisitDetailState(
        status: status ?? this.status,
        detail: detail ?? this.detail,
        failure: failure ?? this.failure,
        working: working ?? this.working,
        actionFailure: clearActionFailure ? null : (actionFailure ?? this.actionFailure),
      );

  @override
  List<Object?> get props => [status, detail, failure, working, actionFailure];
}

class VisitDetailCubit extends Cubit<VisitDetailState> {
  VisitDetailCubit(this._getDetail, this._updateStatus, {required this.visitId})
      : super(const VisitDetailState());

  final GetVisitDetail _getDetail;
  final UpdateVisitStatus _updateStatus;
  final String visitId;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getDetail(visitId);
    result.when(
      ok: (detail) => emit(state.copyWith(status: DataStatus.success, detail: detail)),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> apply(VisitTransition transition, {String? notes, String? reason}) async {
    if (state.working) return;
    emit(state.copyWith(working: true, clearActionFailure: true));
    final result = await _updateStatus(UpdateVisitStatusParams(
      id: visitId,
      transition: transition,
      notes: notes,
      reason: reason,
    ));
    final failure = result.failureOrNull;
    if (failure != null) {
      emit(state.copyWith(working: false, actionFailure: failure));
      return;
    }
    final refreshed = await _getDetail(visitId);
    refreshed.when(
      ok: (detail) => emit(state.copyWith(working: false, detail: detail, status: DataStatus.success)),
      err: (_) => emit(state.copyWith(working: false)),
    );
  }
}
