import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/reservation.dart';
import '../../domain/usecases/reservation_use_cases.dart';

class ReservationDetailState extends Equatable {
  const ReservationDetailState({
    this.status = DataStatus.initial,
    this.detail,
    this.failure,
    this.working = false,
    this.actionFailure,
  });

  final DataStatus status;
  final ReservationDetail? detail;
  final AppFailure? failure;
  final bool working;
  final AppFailure? actionFailure;

  ReservationDetailState copyWith({
    DataStatus? status,
    ReservationDetail? detail,
    AppFailure? failure,
    bool? working,
    AppFailure? actionFailure,
    bool clearActionFailure = false,
  }) =>
      ReservationDetailState(
        status: status ?? this.status,
        detail: detail ?? this.detail,
        failure: failure ?? this.failure,
        working: working ?? this.working,
        actionFailure: clearActionFailure ? null : (actionFailure ?? this.actionFailure),
      );

  @override
  List<Object?> get props => [status, detail, failure, working, actionFailure];
}

class ReservationDetailCubit extends Cubit<ReservationDetailState> {
  ReservationDetailCubit(this._getDetail, this._addNote, {required this.reservationId})
      : super(const ReservationDetailState());

  final GetReservationDetail _getDetail;
  final AddReservationNote _addNote;
  final String reservationId;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getDetail(reservationId);
    result.when(
      ok: (detail) => emit(state.copyWith(status: DataStatus.success, detail: detail)),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> addNote(String body) async {
    if (state.working || body.trim().isEmpty) return;
    emit(state.copyWith(working: true, clearActionFailure: true));
    final result = await _addNote(AddReservationNoteParams(id: reservationId, body: body.trim()));
    final failure = result.failureOrNull;
    if (failure != null) {
      emit(state.copyWith(working: false, actionFailure: failure));
      return;
    }
    final refreshed = await _getDetail(reservationId);
    refreshed.when(
      ok: (detail) => emit(state.copyWith(working: false, detail: detail, status: DataStatus.success)),
      err: (_) => emit(state.copyWith(working: false)),
    );
  }
}
