import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/maintenance_request.dart';
import '../../domain/usecases/maintenance_use_cases.dart';

class MaintenanceDetailState extends Equatable {
  const MaintenanceDetailState({
    this.status = DataStatus.initial,
    this.detail,
    this.failure,
    this.working = false,
    this.actionFailure,
  });

  final DataStatus status;
  final MaintenanceDetail? detail;
  final AppFailure? failure;
  final bool working;
  final AppFailure? actionFailure;

  MaintenanceDetailState copyWith({
    DataStatus? status,
    MaintenanceDetail? detail,
    AppFailure? failure,
    bool? working,
    AppFailure? actionFailure,
    bool clearActionFailure = false,
  }) =>
      MaintenanceDetailState(
        status: status ?? this.status,
        detail: detail ?? this.detail,
        failure: failure ?? this.failure,
        working: working ?? this.working,
        actionFailure: clearActionFailure ? null : (actionFailure ?? this.actionFailure),
      );

  @override
  List<Object?> get props => [status, detail, failure, working, actionFailure];
}

class MaintenanceDetailCubit extends Cubit<MaintenanceDetailState> {
  MaintenanceDetailCubit(
    this._getDetail,
    this._updateStatus,
    this._confirm, {
    required this.requestId,
  }) : super(const MaintenanceDetailState());

  final GetMaintenanceDetail _getDetail;
  final UpdateMaintenanceStatus _updateStatus;
  final ConfirmMaintenanceResolution _confirm;
  final String requestId;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getDetail(requestId);
    result.when(
      ok: (detail) => emit(state.copyWith(status: DataStatus.success, detail: detail)),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  /// Apply a status transition, then re-fetch detail. Mirrors the visits
  /// detail cubit: working=true in flight, actionFailure on error (the screen
  /// listens and shows a snackbar), fresh detail on success.
  Future<void> applyTransition(MaintenanceTransition transition) async {
    await _runAction(() => _updateStatus(
          UpdateMaintenanceStatusParams(id: requestId, transition: transition),
        ));
  }

  Future<void> confirmResolution() async {
    await _runAction(() => _confirm(requestId));
  }

  Future<void> _runAction(Future<Result<void>> Function() action) async {
    if (state.working) return;
    emit(state.copyWith(working: true, clearActionFailure: true));
    final result = await action();
    final failure = result.failureOrNull;
    if (failure != null) {
      emit(state.copyWith(working: false, actionFailure: failure));
      return;
    }
    final refreshed = await _getDetail(requestId);
    refreshed.when(
      ok: (detail) => emit(state.copyWith(working: false, detail: detail, status: DataStatus.success)),
      err: (_) => emit(state.copyWith(working: false)),
    );
  }
}
