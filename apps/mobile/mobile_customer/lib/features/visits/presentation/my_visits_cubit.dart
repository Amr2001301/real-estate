import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/visit_request.dart';
import '../domain/usecases/confirm_visit_appointment.dart';
import '../domain/usecases/get_my_visit_requests.dart';
import '../domain/usecases/request_visit_reschedule.dart';

/// Outcome of a per-appointment customer action (confirm or request
/// reschedule). Carried as a one-shot field on [MyVisitsState] so a
/// `listenWhen` block in the screen can fire a SnackBar exactly once per
/// fresh event. Equality is intentionally identity-based — every new outcome
/// is a fresh instance so the listener re-fires even for repeat outcomes.
class VisitActionOutcome {
  VisitActionOutcome.success(this.kind) : failure = null;
  VisitActionOutcome.failure(this.kind, AppFailure this.failure);

  final VisitActionKind kind;
  final AppFailure? failure;

  bool get isSuccess => failure == null;
}

enum VisitActionKind { confirm, requestReschedule }

/// State for [MyVisitsCubit].
///
/// Combines the list-load surface (`dataState`) with per-appointment action
/// tracking. `inFlightAppointmentId` is non-null while a confirm /
/// request-reschedule call is in flight — the UI uses it to disable the
/// affected card's buttons. `lastOutcome` carries the one-shot signal for
/// the SnackBar listener and is intentionally NOT included in
/// `Equatable.props` (see comment on [VisitActionOutcome]).
class MyVisitsState extends Equatable {
  const MyVisitsState({
    required this.dataState,
    this.inFlightAppointmentId,
    this.lastOutcome,
  });

  factory MyVisitsState.initial() =>
      const MyVisitsState(dataState: DataState<List<VisitRequest>>.initial());

  final DataState<List<VisitRequest>> dataState;
  final String? inFlightAppointmentId;
  final VisitActionOutcome? lastOutcome;

  // Convenience accessors mirror the previous typedef'd state so existing
  // call sites that read `state.status` / `state.data` / `state.failure`
  // keep compiling without forcing every consumer through `state.dataState`.
  DataStatus get status => dataState.status;
  List<VisitRequest>? get data => dataState.data;
  AppFailure? get failure => dataState.failure;

  MyVisitsState copyWith({
    DataState<List<VisitRequest>>? dataState,
    String? inFlightAppointmentId,
    VisitActionOutcome? lastOutcome,
    bool clearInFlight = false,
  }) =>
      MyVisitsState(
        dataState: dataState ?? this.dataState,
        inFlightAppointmentId:
            clearInFlight ? null : (inFlightAppointmentId ?? this.inFlightAppointmentId),
        lastOutcome: lastOutcome ?? this.lastOutcome,
      );

  @override
  List<Object?> get props => [dataState, inFlightAppointmentId, lastOutcome];
}

class MyVisitsCubit extends Cubit<MyVisitsState> {
  MyVisitsCubit(
    this._getMyVisits, {
    ConfirmVisitAppointment? confirmVisitAppointment,
    RequestVisitReschedule? requestVisitReschedule,
  })  : _confirm = confirmVisitAppointment,
        _requestReschedule = requestVisitReschedule,
        super(MyVisitsState.initial());

  final GetMyVisitRequests _getMyVisits;
  final ConfirmVisitAppointment? _confirm;
  final RequestVisitReschedule? _requestReschedule;

  Future<void> load() async {
    emit(state.copyWith(dataState: state.dataState.toLoading()));
    final result = await _getMyVisits(1);
    result.when(
      ok: (page) => emit(
        state.copyWith(
          dataState: page.data.isEmpty
              ? const DataState<List<VisitRequest>>.empty()
              : DataState<List<VisitRequest>>.success(page.data),
        ),
      ),
      err: (failure) =>
          emit(state.copyWith(dataState: state.dataState.toFailure(failure))),
    );
  }

  /// Customer confirms an admin-proposed appointment. On success, refreshes
  /// the list (the appointment status flips to CONFIRMED). On failure, emits
  /// a one-shot outcome so the screen can show a SnackBar without losing the
  /// existing list state.
  Future<void> confirmAppointment(String appointmentId) async {
    final useCase = _confirm;
    if (useCase == null) return;
    emit(state.copyWith(inFlightAppointmentId: appointmentId));
    final result = await useCase(appointmentId);
    await result.when(
      ok: (_) async {
        emit(state.copyWith(
          clearInFlight: true,
          lastOutcome: VisitActionOutcome.success(VisitActionKind.confirm),
        ));
        await load();
      },
      err: (failure) async {
        emit(state.copyWith(
          clearInFlight: true,
          lastOutcome:
              VisitActionOutcome.failure(VisitActionKind.confirm, failure),
        ));
      },
    );
  }

  /// Customer asks the admin to reschedule. Same one-shot outcome semantics.
  Future<void> requestReschedule(String appointmentId, {String? reason}) async {
    final useCase = _requestReschedule;
    if (useCase == null) return;
    emit(state.copyWith(inFlightAppointmentId: appointmentId));
    final result = await useCase(
      RequestVisitRescheduleParams(appointmentId: appointmentId, reason: reason),
    );
    await result.when(
      ok: (_) async {
        emit(state.copyWith(
          clearInFlight: true,
          lastOutcome:
              VisitActionOutcome.success(VisitActionKind.requestReschedule),
        ));
        await load();
      },
      err: (failure) async {
        emit(state.copyWith(
          clearInFlight: true,
          lastOutcome: VisitActionOutcome.failure(
            VisitActionKind.requestReschedule,
            failure,
          ),
        ));
      },
    );
  }
}
